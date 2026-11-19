import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import {
  MailService,
  PriceChangeDirection,
  SprintNotificationChange,
} from '../common/mail/mail.service';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

export interface CampaignJobPayload {
  notificationId: number;
  sprintId: number;
  sprintName: string;
  kind:
    | 'SCHEDULE_OR_LOCATION_UPDATED'
    | 'PRICE_UPDATED'
    | 'POSTPONED_OR_SUSPENDED'
    | 'SESSION_REACTIVATED';
  changes?: SprintNotificationChange[];
  priceDirection?: PriceChangeDirection;
  newStatus?: 'DRAFT' | 'INACTIVE';
  note?: string;
  startAtIso?: string;
  endAtIso?: string;
  city?: string | null;
  location?: string | null;
}

interface BatchJobPayload {
  notificationId: number;
  campaign: Omit<CampaignJobPayload, 'notificationId' | 'sprintId'>;
  targets: Array<{ email: string; name: string }>;
}

export interface GenericBatchJobPayload {
  notificationId: number;
  items: Array<{ email: string; name: string; subject: string; html: string }>;
}

const QUEUE_NAME = 'sprint-notifications';
const CURSOR_PAGE_SIZE = 500;
const RESEND_BATCH_SIZE = 100;
const MAX_PREVIEW_RECIPIENTS = 200;

@Injectable()
export class SprintNotificationQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SprintNotificationQueueService.name);
  private connection: Redis | null = null;
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL')?.trim();
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL absente : file BullMQ desactivee (fallback synchrone).',
      );
      return;
    }

    this.connection =
      this.redis?.createBlockingConnection() ??
      new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });

    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        if (job.name === 'dispatch-campaign') {
          await this.processCampaign(job.data as CampaignJobPayload);
        } else if (job.name === 'send-batch') {
          await this.processBatch(job.data as BatchJobPayload);
        } else if (job.name === 'send-generic-batch') {
          await this.processGenericBatch(job.data as GenericBatchJobPayload);
        }
      },
      {
        connection: this.connection,
        concurrency: 2,
        limiter: { max: 4, duration: 1000 },
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.warn(
        `Job ${job?.name ?? 'unknown'} #${job?.id ?? '?'} echoue: ${err.message}`,
      );
    });

    this.logger.log('File BullMQ Redis (sprint-notifications) initialisee.');
  }

  async onModuleDestroy() {
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
    await this.connection?.quit().catch(() => undefined);
  }

  isReady(): boolean {
    return this.queue !== null;
  }

  async enqueueCampaign(payload: CampaignJobPayload): Promise<boolean> {
    if (!this.queue) return false;
    await this.queue.add('dispatch-campaign', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });
    return true;
  }

  async enqueueGenericCampaign(
    notificationId: number,
    items: Array<{ email: string; name: string; subject: string; html: string }>,
  ): Promise<boolean> {
    if (!this.queue) return false;
    for (let i = 0; i < items.length; i += RESEND_BATCH_SIZE) {
      await this.queue.add(
        'send-generic-batch',
        {
          notificationId,
          items: items.slice(i, i + RESEND_BATCH_SIZE),
        } satisfies GenericBatchJobPayload,
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    }
    return true;
  }

  private async processCampaign(payload: CampaignJobPayload) {
    if (!this.queue) return;

    await this.prisma.sprintNotification.update({
      where: { id: payload.notificationId },
      data: { status: 'PROCESSING' },
    });

    const seen = new Set<string>();
    const pendingBatch: Array<{ email: string; name: string }> = [];
    let lastId = 0;
    let totalRecipients = 0;

    while (true) {
      const rows = await this.prisma.enrollment.findMany({
        where: {
          sprintId: payload.sprintId,
          status: { not: 'CANCELLED' },
          payments: { some: { status: 'SUCCESS' } },
          id: { gt: lastId },
        },
        select: {
          id: true,
          student: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { id: 'asc' },
        take: CURSOR_PAGE_SIZE,
      });

      if (rows.length === 0) break;
      lastId = rows[rows.length - 1].id;

      for (const row of rows) {
        const email = row.student.email.trim();
        const key = email.toLowerCase();
        if (!email || seen.has(key)) continue;
        seen.add(key);
        const name =
          `${row.student.firstName} ${row.student.lastName}`.trim() ||
          'Participant';
        pendingBatch.push({ email, name });
        totalRecipients += 1;

        if (pendingBatch.length >= RESEND_BATCH_SIZE) {
          await this.enqueueBatch(
            payload,
            pendingBatch.splice(0, RESEND_BATCH_SIZE),
          );
        }
      }
    }

    if (pendingBatch.length > 0) {
      await this.enqueueBatch(payload, pendingBatch);
    }

    await this.prisma.sprintNotification.update({
      where: { id: payload.notificationId },
      data: {
        totalRecipients,
        status: totalRecipients === 0 ? 'COMPLETED' : 'PROCESSING',
      },
    });
  }

  private async enqueueBatch(
    payload: CampaignJobPayload,
    targets: Array<{ email: string; name: string }>,
  ) {
    if (!this.queue) return;
    const batchData: BatchJobPayload = {
      notificationId: payload.notificationId,
      campaign: {
        sprintName: payload.sprintName,
        kind: payload.kind,
        changes: payload.changes,
        priceDirection: payload.priceDirection,
        newStatus: payload.newStatus,
        note: payload.note,
        startAtIso: payload.startAtIso,
        endAtIso: payload.endAtIso,
        city: payload.city,
        location: payload.location,
      },
      targets,
    };
    await this.queue.add('send-batch', batchData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }

  private async processBatch(data: BatchJobPayload) {
    const { campaign, targets, notificationId } = data;
    const mailItems = targets.map((t) => ({
      to: t.email,
      studentName: t.name,
      sprintName: campaign.sprintName,
      kind: campaign.kind,
      changes: campaign.changes,
      priceDirection: campaign.priceDirection,
      newStatus: campaign.newStatus,
      note: campaign.note,
      startAt: campaign.startAtIso ? new Date(campaign.startAtIso) : undefined,
      endAt: campaign.endAtIso ? new Date(campaign.endAtIso) : undefined,
      city: campaign.city,
      location: campaign.location,
    }));

    const { sent, failed } =
      await this.mail.sendSprintNotificationBatch(mailItems);
    await this.recordBatchOutcome(notificationId, targets, sent, failed);
  }

  private async processGenericBatch(data: GenericBatchJobPayload) {
    const { sent, failed } = await this.mail.sendGenericBatch(
      data.items.map((i) => ({ to: i.email, subject: i.subject, html: i.html })),
    );
    await this.recordBatchOutcome(
      data.notificationId,
      data.items.map((i) => ({ email: i.email, name: i.name })),
      sent,
      failed,
    );
  }

  private async recordBatchOutcome(
    notificationId: number,
    targets: Array<{ email: string; name: string }>,
    sent: string[],
    failed: string[],
  ) {
    const sentSet = new Set(sent.map((e) => e.toLowerCase()));
    const batchRecipients = targets.map((t) => ({
      email: t.email,
      name: t.name,
      sent: sentSet.has(t.email.toLowerCase()),
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "sprint_notifications" WHERE "id" = ${notificationId} FOR UPDATE`;
      const existing = await tx.sprintNotification.findUnique({
        where: { id: notificationId },
        select: {
          sentCount: true,
          failedCount: true,
          totalRecipients: true,
          recipients: true,
        },
      });
      if (!existing) return;

      const currentPreview = Array.isArray(existing.recipients)
        ? (existing.recipients as Array<{
            email: string;
            name: string;
            sent: boolean;
          }>)
        : [];
      const remainingSlots = Math.max(
        0,
        MAX_PREVIEW_RECIPIENTS - currentPreview.length,
      );
      const nextPreview =
        remainingSlots > 0
          ? [...currentPreview, ...batchRecipients.slice(0, remainingSlots)]
          : currentPreview;

      const nextSent = existing.sentCount + sent.length;
      const nextFailed = existing.failedCount + failed.length;
      const done =
        existing.totalRecipients > 0 &&
        nextSent + nextFailed >= existing.totalRecipients;

      await tx.sprintNotification.update({
        where: { id: notificationId },
        data: {
          sentCount: nextSent,
          failedCount: nextFailed,
          recipients: nextPreview as unknown as Prisma.InputJsonValue,
          status: done ? 'COMPLETED' : 'PROCESSING',
        },
      });
    });
  }
}

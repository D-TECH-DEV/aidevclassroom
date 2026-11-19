import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, SprintStatus } from '@prisma/client';
import {
  formatDateAbidjan,
  formatXof,
} from '../common/export/export-format.util';
import {
  MailService,
  PriceChangeDirection,
  SprintNotificationChange,
} from '../common/mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { countEnrolled } from './enrolled-count.util';
import { SprintNotificationQueueService } from './sprint-notification.queue';
import {
  computeSprintSelection,
  type SelectionEntry,
} from './sprint-selection.util';
import {
  buildSprintUpdateData,
  checkSprintAmounts,
  normalizeModules,
  normalizeOptionalText,
} from './sprint-validation.util';

export const SPRINT_TRANSITIONS: Record<SprintStatus, SprintStatus[]> = {
  DRAFT: ['ACTIVE', 'INACTIVE', 'COMPLETED'],
  ACTIVE: ['DRAFT', 'INACTIVE', 'COMPLETED'],
  INACTIVE: ['DRAFT', 'ACTIVE', 'COMPLETED'],
  COMPLETED: ['DRAFT', 'ACTIVE', 'INACTIVE'],
};

export interface SprintNotificationRecipientResult {
  email: string;
  name: string;
  sent: boolean;
}

export interface SprintNotificationSummary {
  kind:
    | 'SCHEDULE_OR_LOCATION_UPDATED'
    | 'PRICE_UPDATED'
    | 'POSTPONED_OR_SUSPENDED'
    | 'SESSION_REACTIVATED'
    | 'SELECTION_SELECTED'
    | 'SELECTION_WAITLIST';
  queued?: boolean;
  notificationId?: number;
  sentCount: number;
  failedCount: number;
  recipients: SprintNotificationRecipientResult[];
}

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly mail?: MailService,
    @Optional()
    private readonly notificationQueue?: SprintNotificationQueueService,
  ) {}

  async create(data: {
    name: string;
    slug: string;
    description?: string;
    priceXof: number;
    minimumPaymentXof: number;
    duoPriceXof?: number | null;
    duoMinimumPaymentXof?: number | null;
    startAt: string;
    endAt: string;
    capacity?: number;
    city?: string;
    location?: string;
    format?: string;
    level?: string;
    modules?: string[];
    status?: SprintStatus;
  }) {
    checkSprintAmounts(
      data.priceXof,
      data.minimumPaymentXof,
      data.duoPriceXof,
      data.duoMinimumPaymentXof,
    );
    if (new Date(data.startAt) >= new Date(data.endAt)) {
      throw new BadRequestException({
        code: 'INVALID_DATES',
        message: 'La date de fin doit etre posterieure a la date de debut.',
      });
    }
    try {
      return await this.prisma.sprint.create({
        data: {
          name: data.name.trim(),
          slug: data.slug.trim().toLowerCase(),
          description: data.description,
          priceXof: data.priceXof,
          minimumPaymentXof: data.minimumPaymentXof,
          duoPriceXof: data.duoPriceXof ?? null,
          duoMinimumPaymentXof: data.duoMinimumPaymentXof ?? null,
          startAt: new Date(data.startAt),
          endAt: new Date(data.endAt),
          capacity: data.capacity ?? null,
          city: normalizeOptionalText(data.city),
          location: normalizeOptionalText(data.location),
          format: normalizeOptionalText(data.format),
          level: normalizeOptionalText(data.level),
          modules: normalizeModules(data.modules) ?? Prisma.JsonNull,
          status: data.status ?? 'DRAFT',
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'SPRINT_SLUG_EXISTS',
          message: 'Ce slug de Sprint existe deja.',
        });
      }
      throw e;
    }
  }

  async listPublic(page = 1, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const base = await this.listWhere(
      { status: { in: [SprintStatus.ACTIVE, SprintStatus.INACTIVE] } },
      skip,
      take,
    );
    const counts = await this.countMap(base.items);
    return {
      ...base,
      items: base.items.map((sprint) => ({
        ...sprint,
        ...counts.get(sprint.id),
      })),
    };
  }

  async listAll(page = 1, limit = 50, status?: SprintStatus) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const base = await this.listWhere(status ? { status } : {}, skip, take);
    const counts = await this.countMap(base.items);
    return {
      ...base,
      items: base.items.map((sprint) => ({
        ...sprint,
        ...counts.get(sprint.id),
      })),
    };
  }

  private async listWhere(
    where: Prisma.SprintWhereInput,
    skip: number,
    take: number,
  ) {
    const [items, total] = await Promise.all([
      this.prisma.sprint.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sprint.count({ where }),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, limit: take };
  }

  async detailPublic(id: number) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id } });
    if (!sprint || sprint.status !== 'ACTIVE') {
      throw new NotFoundException({
        code: 'SPRINT_NOT_FOUND',
        message: 'Sprint introuvable.',
      });
    }
    const counts = await this.countMap([sprint]);
    return { ...sprint, ...counts.get(sprint.id) };
  }

  async countEnrolled(id: number) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id } });
    if (
      !sprint ||
      (sprint.status !== 'ACTIVE' && sprint.status !== 'INACTIVE')
    ) {
      throw new NotFoundException({
        code: 'SPRINT_NOT_FOUND',
        message: 'Sprint introuvable.',
      });
    }
    const counts = await this.countMap([sprint]);
    return {
      sprintId: sprint.id,
      capacity: sprint.capacity,
      ...counts.get(sprint.id),
    };
  }

  private async countMap(
    sprints: {
      id: number;
      minimumPaymentXof: number;
      duoMinimumPaymentXof?: number | null;
    }[],
  ) {
    const counts = new Map<
      number,
      { enrolledCount: number; enrolledSeats: number; hasEnrollments: boolean }
    >();
    for (const sprint of sprints) {
      counts.set(sprint.id, {
        enrolledCount: 0,
        enrolledSeats: 0,
        hasEnrollments: false,
      });
    }
    if (sprints.length === 0 || !this.prisma.enrollment?.findMany) {
      return counts;
    }
    const thresholds = new Map(
      sprints.map((s) => [
        s.id,
        {
          minimum: s.minimumPaymentXof,
          duoMinimum: s.duoMinimumPaymentXof ?? null,
        },
      ]),
    );
    const rows = await this.prisma.enrollment.findMany({
      where: {
        sprintId: { in: sprints.map((s) => s.id) },
        status: { not: 'CANCELLED' },
      },
      select: {
        sprintId: true,
        plan: true,
        status: true,
        totalAmountXof: true,
        payments: {
          where: { status: 'SUCCESS' },
          select: { status: true, amountXof: true },
        },
      },
    });
    const anyRows =
      (await this.prisma.enrollment
        .groupBy?.({
          by: ['sprintId'],
          where: { sprintId: { in: sprints.map((s) => s.id) } },
        })
        .catch(() => [])) ?? [];
    const anySet = new Set(anyRows.map((r) => r.sprintId));

    const grouped = new Map<number, typeof rows>();
    for (const row of rows) {
      const list = grouped.get(row.sprintId) ?? [];
      list.push(row);
      grouped.set(row.sprintId, list);
    }
    for (const sprint of sprints) {
      const list = grouped.get(sprint.id) ?? [];
      const threshold = thresholds.get(sprint.id);
      if (!threshold) continue;
      const c = countEnrolled(list, threshold.minimum, threshold.duoMinimum);
      counts.set(sprint.id, {
        ...c,
        hasEnrollments: list.length > 0 || anySet.has(sprint.id),
      });
    }
    return counts;
  }

  async detail(id: number) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id } });
    if (!sprint) {
      throw new NotFoundException({
        code: 'SPRINT_NOT_FOUND',
        message: 'Sprint introuvable.',
      });
    }
    const counts = await this.countMap([sprint]);
    return { ...sprint, ...counts.get(sprint.id) };
  }

  async update(
    id: number,
    data: Partial<{
      name: string;
      description: string;
      priceXof: number;
      minimumPaymentXof: number;
      duoPriceXof: number | null;
      duoMinimumPaymentXof: number | null;
      startAt: string;
      endAt: string;
      capacity: number | null;
      city: string | null;
      location: string | null;
      format: string | null;
      level: string | null;
      modules: string[] | null;
      notifyParticipants: boolean;
      notificationNote: string;
    }>,
  ) {
    const sprint = await this.detail(id);
    const priceXof = data.priceXof ?? sprint.priceXof;
    const minimum = data.minimumPaymentXof ?? sprint.minimumPaymentXof;
    const duoPrice =
      data.duoPriceXof !== undefined
        ? data.duoPriceXof
        : ((sprint as { duoPriceXof?: number | null }).duoPriceXof ?? null);
    const duoMinimum =
      data.duoMinimumPaymentXof !== undefined
        ? data.duoMinimumPaymentXof
        : ((sprint as { duoMinimumPaymentXof?: number | null })
            .duoMinimumPaymentXof ?? null);
    checkSprintAmounts(priceXof, minimum, duoPrice, duoMinimum);
    const startAt = data.startAt ? new Date(data.startAt) : sprint.startAt;
    const endAt = data.endAt ? new Date(data.endAt) : sprint.endAt;
    if (startAt >= endAt) {
      throw new BadRequestException({ code: 'INVALID_DATES', message: 'La date de fin doit etre posterieure a la date de debut.' });
    }
    const updated = await this.prisma.sprint.update({
      where: { id },
      data: buildSprintUpdateData(data, startAt, endAt),
    });

    const scheduleChanges = this.detectScheduleOrLocationChanges(sprint, updated);
    const { changes: priceChanges, direction: priceDirection } =
      this.detectPriceChanges(sprint, updated);
    const changes = [...scheduleChanges, ...priceChanges];
    if (
      data.notifyParticipants !== false &&
      sprint.status === 'ACTIVE' &&
      changes.length > 0
    ) {
      const kind =
        priceChanges.length > 0
          ? 'PRICE_UPDATED'
          : 'SCHEDULE_OR_LOCATION_UPDATED';
      const notification = await this.notifyPaidEnrollments({
        sprintId: id,
        sprintName: updated.name,
        kind,
        changes,
        priceDirection: priceChanges.length > 0 ? priceDirection : undefined,
        note: data.notificationNote,
        startAt: updated.startAt,
        endAt: updated.endAt,
        city: updated.city,
        location: updated.location,
      });
      return { ...updated, notification };
    }
    return updated;
  }

  async changeStatus(
    id: number,
    status: SprintStatus,
    opts?: { notifyParticipants?: boolean; notificationNote?: string },
  ) {
    const sprint = await this.detail(id);
    if (sprint.status !== status && !SPRINT_TRANSITIONS[sprint.status].includes(status)) {
      throw new BadRequestException({ code: 'INVALID_STATUS_TRANSITION', message: `Transition de ${sprint.status} vers ${status} non permise.` });
    }
    const updated = await this.prisma.sprint.update({ where: { id }, data: { status } });
    if (
      opts?.notifyParticipants !== false &&
      sprint.status === 'ACTIVE' &&
      (status === 'DRAFT' || status === 'INACTIVE')
    ) {
      const notification = await this.notifyPaidEnrollments({
        sprintId: id,
        sprintName: updated.name,
        kind: 'POSTPONED_OR_SUSPENDED',
        newStatus: status,
        note: opts?.notificationNote,
      });
      return { ...updated, notification };
    }
    if (
      opts?.notifyParticipants !== false &&
      (sprint.status === 'DRAFT' || sprint.status === 'INACTIVE') &&
      status === 'ACTIVE'
    ) {
      const notification = await this.notifyPaidEnrollments({
        sprintId: id,
        sprintName: updated.name,
        kind: 'SESSION_REACTIVATED',
        note: opts?.notificationNote,
        startAt: updated.startAt,
        endAt: updated.endAt,
        city: updated.city,
        location: updated.location,
      });
      return { ...updated, notification };
    }
    return updated;
  }

  async listNotifications(page = 1, limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * safeLimit;
    const [items, total] = await Promise.all([
      this.prisma.sprintNotification.findMany({
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          sprint: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.sprintNotification.count(),
    ]);
    return {
      items,
      total,
      page: Math.max(page, 1),
      limit: safeLimit,
    };
  }

  private async computeFullSelection(id: number) {
    const sprint = await this.detail(id);
    const rows = await this.prisma.enrollment.findMany({
      where: { sprintId: id, status: { not: 'CANCELLED' } },
      select: {
        id: true,
        plan: true,
        status: true,
        totalAmountXof: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        payments: {
          where: { status: 'SUCCESS' },
          select: { amountXof: true, paidAt: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const inputs = rows.map((r) => {
      const paidXof = r.payments.reduce((s, p) => s + p.amountXof, 0);
      const firstPay = r.payments[0];
      return {
        id: r.id,
        plan: r.plan,
        status: r.status,
        totalAmountXof: r.totalAmountXof,
        paidXof,
        firstPaidAt: firstPay ? (firstPay.paidAt ?? firstPay.createdAt) : null,
        createdAt: r.createdAt,
        student: r.student,
      };
    });

    const selection = computeSprintSelection(inputs, sprint.capacity ?? null);
    return { sprint, ...selection };
  }

  async getSelection(
    id: number,
    opts: {
      group?: 'selected' | 'waitlist' | 'unpaid';
      page?: number;
      limit?: number;
      search?: string;
    } = {},
  ) {
    const full = await this.computeFullSelection(id);
    const group = opts.group ?? 'selected';
    const safeLimit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const safePage = Math.max(opts.page ?? 1, 1);

    const source =
      group === 'waitlist'
        ? full.waitlist
        : group === 'unpaid'
          ? full.unpaid
          : full.selected;

    const tokens = (opts.search ?? '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    const filtered =
      tokens.length > 0
        ? source.filter((item) => {
            const hay = `${item.studentName} ${item.email} ${item.phone}`.toLowerCase();
            return tokens.every((t) => hay.includes(t));
          })
        : source;

    const skip = (safePage - 1) * safeLimit;
    const items = filtered.slice(skip, skip + safeLimit);

    return {
      sprint: full.sprint,
      capacity: full.capacity,
      seatsUsed: full.seatsUsed,
      seatsRemaining: full.seatsRemaining,
      selectedCount: full.selectedCount,
      waitlistCount: full.waitlistCount,
      unpaidCount: full.unpaidCount,
      totalRefundableTwoThirdsXof: full.totalRefundableTwoThirdsXof,
      group,
      items,
      total: filtered.length,
      page: safePage,
      limit: safeLimit,
    };
  }

  async notifySelection(
    id: number,
    opts?: { notifyParticipants?: boolean; note?: string },
  ) {
    const { sprint, ...selection } = await this.computeFullSelection(id);
    if (opts?.notifyParticipants === false) {
      return {
        ...selection,
        notifications: [],
      };
    }

    const notifications: SprintNotificationSummary[] = [];

    const groups: Array<{
      kind: 'SELECTION_SELECTED' | 'SELECTION_WAITLIST';
      entries: SelectionEntry[];
    }> = [
      { kind: 'SELECTION_SELECTED', entries: selection.selected },
      { kind: 'SELECTION_WAITLIST', entries: selection.waitlist },
    ];

    for (const group of groups) {
      if (group.entries.length === 0) continue;
      const summary = await this.dispatchSelectionGroup({
        sprint,
        kind: group.kind,
        entries: group.entries,
        note: opts?.note,
      });
      notifications.push(summary);
    }

    return {
      ...selection,
      notifications,
    };
  }

  private async dispatchSelectionGroup(params: {
    sprint: { id: number; name: string; startAt: Date; city?: string | null; location?: string | null };
    kind: 'SELECTION_SELECTED' | 'SELECTION_WAITLIST';
    entries: SelectionEntry[];
    note?: string;
  }): Promise<SprintNotificationSummary> {
    const uniqueByEmail = new Map<string, SelectionEntry>();
    for (const entry of params.entries) {
      const key = entry.email.trim().toLowerCase();
      if (!key || uniqueByEmail.has(key)) continue;
      uniqueByEmail.set(key, entry);
    }
    const deduped = Array.from(uniqueByEmail.values());
    const previewSample = deduped[0];
    const preview =
      previewSample && this.mail
        ? this.mail.buildSelectionEmailContent({
            studentName: 'Participant',
            sprintName: params.sprint.name,
            kind: params.kind,
            paidXof: previewSample.paidXof,
            remainingXof: previewSample.remainingXof,
            refundableTwoThirdsXof: previewSample.refundableTwoThirdsXof,
            note: params.note,
            startAt: params.sprint.startAt,
            city: params.sprint.city,
            location: params.sprint.location,
          })
        : null;

    const batchItems = deduped.map((e) => {
      const content = this.mail?.buildSelectionEmailContent({
        studentName: e.studentName,
        sprintName: params.sprint.name,
        kind: params.kind,
        paidXof: e.paidXof,
        remainingXof: e.remainingXof,
        refundableTwoThirdsXof: e.refundableTwoThirdsXof,
        note: params.note,
        startAt: params.sprint.startAt,
        city: params.sprint.city,
        location: params.sprint.location,
      });
      return {
        email: e.email,
        name: e.studentName,
        subject: content?.subject ?? '',
        html: content?.html ?? '',
      };
    });

    if (this.notificationQueue?.isReady() && this.prisma.sprintNotification) {
      const created = await this.prisma.sprintNotification.create({
        data: {
          sprintId: params.sprint.id,
          kind: params.kind,
          status: 'QUEUED',
          subject: preview?.subject ?? null,
          htmlContent: preview?.html ?? null,
          note: params.note?.trim() || null,
          totalRecipients: batchItems.length,
          sentCount: 0,
          failedCount: 0,
          recipients: [] as unknown as Prisma.InputJsonValue,
        },
      });
      await this.notificationQueue.enqueueGenericCampaign(
        created.id,
        batchItems,
      );
      return {
        kind: params.kind,
        queued: true,
        notificationId: created.id,
        sentCount: 0,
        failedCount: 0,
        recipients: [],
      };
    }

    const { sent, failed } = this.mail
      ? await this.mail.sendGenericBatch(
          batchItems.map((i) => ({
            to: i.email,
            subject: i.subject,
            html: i.html,
          })),
        )
      : { sent: [], failed: batchItems.map((i) => i.email) };
    const sentSet = new Set(sent.map((e) => e.toLowerCase()));
    const recipients = batchItems.map((i) => ({
      email: i.email,
      name: i.name,
      sent: sentSet.has(i.email.toLowerCase()),
    }));

    await this.prisma.sprintNotification
      ?.create({
        data: {
          sprintId: params.sprint.id,
          kind: params.kind,
          status: 'COMPLETED',
          subject: preview?.subject ?? null,
          htmlContent: preview?.html ?? null,
          note: params.note?.trim() || null,
          totalRecipients: recipients.length,
          sentCount: sent.length,
          failedCount: failed.length,
          recipients: recipients.slice(0, 200) as unknown as Prisma.InputJsonValue,
        },
      })
      .catch(() => undefined);

    return {
      kind: params.kind,
      sentCount: sent.length,
      failedCount: failed.length,
      recipients,
    };
  }

  private detectScheduleOrLocationChanges(
    before: { startAt: Date; endAt: Date; city?: string | null; location?: string | null },
    after: { startAt: Date; endAt: Date; city?: string | null; location?: string | null },
  ): SprintNotificationChange[] {
    const changes: SprintNotificationChange[] = [];
    if (before.startAt.getTime() !== after.startAt.getTime()) {
      changes.push({
        label: 'Date de début',
        oldValue: formatDateAbidjan(before.startAt),
        newValue: formatDateAbidjan(after.startAt),
      });
    }
    if (before.endAt.getTime() !== after.endAt.getTime()) {
      changes.push({
        label: 'Date de fin',
        oldValue: formatDateAbidjan(before.endAt),
        newValue: formatDateAbidjan(after.endAt),
      });
    }
    const oldCity = (before.city ?? '').trim();
    const newCity = (after.city ?? '').trim();
    if (oldCity !== newCity) {
      changes.push({
        label: 'Ville',
        oldValue: oldCity || 'Non précisée',
        newValue: newCity || 'Non précisée',
      });
    }
    const oldLoc = (before.location ?? '').trim();
    const newLoc = (after.location ?? '').trim();
    if (oldLoc !== newLoc) {
      changes.push({
        label: 'Lieu / Salle',
        oldValue: oldLoc || 'Non précisé',
        newValue: newLoc || 'Non précisé',
      });
    }
    return changes;
  }

  private detectPriceChanges(
    before: { priceXof: number; duoPriceXof?: number | null },
    after: { priceXof: number; duoPriceXof?: number | null },
  ): { changes: SprintNotificationChange[]; direction: PriceChangeDirection } {
    const changes: SprintNotificationChange[] = [];
    let hasIncrease = false;
    let hasDecrease = false;

    if (before.priceXof !== after.priceXof) {
      if (after.priceXof > before.priceXof) hasIncrease = true;
      else hasDecrease = true;
      changes.push({
        label: 'Tarif Solo',
        oldValue: formatXof(before.priceXof),
        newValue: formatXof(after.priceXof),
      });
    }

    const oldDuo = before.duoPriceXof ?? null;
    const newDuo = after.duoPriceXof ?? null;
    if (oldDuo !== newDuo) {
      if (oldDuo !== null && newDuo !== null) {
        if (newDuo > oldDuo) hasIncrease = true;
        else hasDecrease = true;
      }
      changes.push({
        label: 'Tarif Duo (2 places)',
        oldValue: oldDuo !== null ? formatXof(oldDuo) : 'Non proposé',
        newValue: newDuo !== null ? formatXof(newDuo) : 'Désactivé',
      });
    }

    const direction: PriceChangeDirection =
      hasIncrease && hasDecrease
        ? 'mixed'
        : hasIncrease
          ? 'increase'
          : hasDecrease
            ? 'decrease'
            : 'mixed';

    return { changes, direction };
  }

  private async notifyPaidEnrollments(params: {
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
    startAt?: Date;
    endAt?: Date;
    city?: string | null;
    location?: string | null;
  }): Promise<SprintNotificationSummary> {
    const preview = this.mail?.buildSprintNotificationEmailContent({
      studentName: 'Participant',
      sprintName: params.sprintName,
      kind: params.kind,
      changes: params.changes,
      priceDirection: params.priceDirection,
      newStatus: params.newStatus,
      note: params.note,
      startAt: params.startAt,
      endAt: params.endAt,
      city: params.city,
      location: params.location,
    });

    if (this.notificationQueue?.isReady() && this.prisma.sprintNotification) {
      const created = await this.prisma.sprintNotification.create({
        data: {
          sprintId: params.sprintId,
          kind: params.kind,
          status: 'QUEUED',
          subject: preview?.subject ?? null,
          htmlContent: preview?.html ?? null,
          note: params.note?.trim() || null,
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 0,
          recipients: [] as unknown as Prisma.InputJsonValue,
        },
      });
      await this.notificationQueue.enqueueCampaign({
        notificationId: created.id,
        sprintId: params.sprintId,
        sprintName: params.sprintName,
        kind: params.kind,
        changes: params.changes,
        priceDirection: params.priceDirection,
        newStatus: params.newStatus,
        note: params.note,
        startAtIso: params.startAt?.toISOString(),
        endAtIso: params.endAt?.toISOString(),
        city: params.city,
        location: params.location,
      });
      return {
        kind: params.kind,
        queued: true,
        notificationId: created.id,
        sentCount: 0,
        failedCount: 0,
        recipients: [],
      };
    }

    const rows = await this.prisma.enrollment.findMany({
      where: {
        sprintId: params.sprintId,
        status: { not: 'CANCELLED' },
        payments: { some: { status: 'SUCCESS' } },
      },
      select: {
        student: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const uniqueByEmail = new Map<string, { email: string; name: string }>();
    for (const row of rows) {
      const email = row.student.email.trim();
      const key = email.toLowerCase();
      if (!email || uniqueByEmail.has(key)) continue;
      const name = `${row.student.firstName} ${row.student.lastName}`.trim() || 'Participant';
      uniqueByEmail.set(key, { email, name });
    }

    const targets = Array.from(uniqueByEmail.values());
    const recipients: SprintNotificationRecipientResult[] = [];
    const batchSize = 5;

    for (let i = 0; i < targets.length; i += batchSize) {
      const chunk = targets.slice(i, i + batchSize);
      const results = await Promise.all(
        chunk.map(async (target) => {
          const sent = this.mail
            ? await this.mail.sendSprintNotificationEmail({
                to: target.email,
                studentName: target.name,
                sprintName: params.sprintName,
                kind: params.kind,
                changes: params.changes,
                priceDirection: params.priceDirection,
                newStatus: params.newStatus,
                note: params.note,
                startAt: params.startAt,
                endAt: params.endAt,
                city: params.city,
                location: params.location,
              })
            : false;
          return { email: target.email, name: target.name, sent };
        }),
      );
      recipients.push(...results);
    }

    const sentCount = recipients.filter((r) => r.sent).length;
    const failedCount = recipients.length - sentCount;
    await this.prisma.sprintNotification
      ?.create({
        data: {
          sprintId: params.sprintId,
          kind: params.kind,
          status: 'COMPLETED',
          subject: preview?.subject ?? null,
          htmlContent: preview?.html ?? null,
          note: params.note?.trim() || null,
          totalRecipients: recipients.length,
          sentCount,
          failedCount,
          recipients: recipients as unknown as Prisma.InputJsonValue,
        },
      })
      .catch(() => undefined);

    return {
      kind: params.kind,
      sentCount,
      failedCount,
      recipients,
    };
  }

  async remove(id: number) {
    await this.detail(id);
    const count = await this.prisma.enrollment.count({ where: { sprintId: id } });
    if (count > 0) {
      throw new ConflictException({ code: 'SPRINT_HAS_ENROLLMENTS', message: 'Suppression impossible : des inscriptions existent. Desactivez ou terminez le Sprint.' });
    }
    await this.prisma.sprint.delete({ where: { id } });
    return { deleted: true };
  }
}

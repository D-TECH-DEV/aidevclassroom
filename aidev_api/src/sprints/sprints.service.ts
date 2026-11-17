import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SprintStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { countEnrolled } from './enrolled-count.util';
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

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async listPublic(page = 1, limit = 20) {
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

  async listAll(page = 1, limit = 20, status?: SprintStatus) {
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
      { enrolledCount: number; enrolledSeats: number }
    >();
    for (const sprint of sprints) {
      counts.set(sprint.id, { enrolledCount: 0, enrolledSeats: 0 });
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
    const grouped = new Map<number, typeof rows>();
    for (const row of rows) {
      const list = grouped.get(row.sprintId) ?? [];
      list.push(row);
      grouped.set(row.sprintId, list);
    }
    for (const [sprintId, list] of grouped) {
      const threshold = thresholds.get(sprintId);
      if (!threshold) continue;
      counts.set(
        sprintId,
        countEnrolled(list, threshold.minimum, threshold.duoMinimum),
      );
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
    return this.prisma.sprint.update({ where: { id }, data: buildSprintUpdateData(data, startAt, endAt) });
  }

  async changeStatus(id: number, status: SprintStatus) {
    const sprint = await this.detail(id);
    if (sprint.status !== status && !SPRINT_TRANSITIONS[sprint.status].includes(status)) {
      throw new BadRequestException({ code: 'INVALID_STATUS_TRANSITION', message: `Transition de ${sprint.status} vers ${status} non permise.` });
    }
    return this.prisma.sprint.update({ where: { id }, data: { status } });
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

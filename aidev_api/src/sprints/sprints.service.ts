import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SprintStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { countEnrolled } from './enrolled-count.util';

export const SPRINT_TRANSITIONS: Record<SprintStatus, SprintStatus[]> = {
  DRAFT: ['ACTIVE', 'INACTIVE'],
  ACTIVE: ['INACTIVE', 'COMPLETED'],
  INACTIVE: ['ACTIVE', 'DRAFT'],
  COMPLETED: [],
};

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  private checkAmounts(
    priceXof: number,
    minimumPaymentXof: number,
    duoPriceXof?: number | null,
    duoMinimumPaymentXof?: number | null,
  ): void {
    if (minimumPaymentXof > priceXof) {
      throw new BadRequestException({
        code: 'MINIMUM_EXCEEDS_PRICE',
        message: 'Le minimum de versement ne peut pas depasser le prix.',
      });
    }
    if (duoMinimumPaymentXof != null && duoPriceXof == null) {
      throw new BadRequestException({
        code: 'DUO_MINIMUM_WITHOUT_PRICE',
        message: 'Le minimum duo exige un prix duo.',
      });
    }
    if (
      duoPriceXof != null &&
      duoMinimumPaymentXof != null &&
      duoMinimumPaymentXof > duoPriceXof
    ) {
      throw new BadRequestException({
        code: 'DUO_MINIMUM_EXCEEDS_PRICE',
        message: 'Le minimum duo ne peut pas depasser le prix duo.',
      });
    }
  }

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
    status?: SprintStatus;
  }) {
    this.checkAmounts(
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

  /**
   * Le catalogue public : les sprints visibles du site. `ACTIVE` pour
   * les inscriptions ouvertes, `INACTIVE` pour les sessions annoncées
   * en « Bientôt ». Ni les brouillons (`DRAFT`), ni les sessions
   * terminées (`COMPLETED`) : un brouillon n'est pas une annonce, et
   * une session terminée n'est pas à venir.
   */
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

  listAll(page = 1, limit = 20, status?: SprintStatus) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    return this.listWhere(status ? { status } : {}, skip, take);
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

  /**
   * Compteur public d'inscrits : dossiers non annules dont le total des
   * versements SUCCESS atteint le minimum du sprint (minimum duo pour un
   * dossier DUO quand il est defini). Visible pour les sessions `ACTIVE`
   * et `INACTIVE` (le catalogue public), 404 sinon.
   */
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

  /** Compte les inscrits d'un lot de sprints en une seule requete. */
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
    if (sprints.length === 0) return counts;
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
    return sprint;
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
    this.checkAmounts(priceXof, minimum, duoPrice, duoMinimum);
    const startAt = data.startAt ? new Date(data.startAt) : sprint.startAt;
    const endAt = data.endAt ? new Date(data.endAt) : sprint.endAt;
    if (startAt >= endAt) {
      throw new BadRequestException({
        code: 'INVALID_DATES',
        message: 'La date de fin doit etre posterieure a la date de debut.',
      });
    }
    return this.prisma.sprint.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.priceXof !== undefined ? { priceXof: data.priceXof } : {}),
        ...(data.minimumPaymentXof !== undefined
          ? { minimumPaymentXof: data.minimumPaymentXof }
          : {}),
        ...(data.duoPriceXof !== undefined
          ? { duoPriceXof: data.duoPriceXof }
          : {}),
        ...(data.duoMinimumPaymentXof !== undefined
          ? { duoMinimumPaymentXof: data.duoMinimumPaymentXof }
          : {}),
        ...(data.startAt !== undefined ? { startAt } : {}),
        ...(data.endAt !== undefined ? { endAt } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
      },
    });
  }

  async changeStatus(id: number, status: SprintStatus) {
    const sprint = await this.detail(id);
    const allowed = SPRINT_TRANSITIONS[sprint.status];
    if (sprint.status !== status && !allowed.includes(status)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Transition de ${sprint.status} vers ${status} non permise.`,
      });
    }
    return this.prisma.sprint.update({ where: { id }, data: { status } });
  }

  async remove(id: number) {
    await this.detail(id);
    const count = await this.prisma.enrollment.count({
      where: { sprintId: id },
    });
    if (count > 0) {
      throw new ConflictException({
        code: 'SPRINT_HAS_ENROLLMENTS',
        message:
          'Suppression impossible : des inscriptions existent. Desactivez ou terminez le Sprint.',
      });
    }
    await this.prisma.sprint.delete({ where: { id } });
    return { deleted: true };
  }
}

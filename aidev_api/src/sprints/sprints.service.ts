import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SprintStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const SPRINT_TRANSITIONS: Record<SprintStatus, SprintStatus[]> = {
  DRAFT: ['ACTIVE', 'INACTIVE'],
  ACTIVE: ['INACTIVE', 'COMPLETED'],
  INACTIVE: ['ACTIVE', 'DRAFT'],
  COMPLETED: [],
};

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  private checkAmounts(priceXof: number, minimumPaymentXof: number): void {
    if (minimumPaymentXof > priceXof) {
      throw new BadRequestException({
        code: 'MINIMUM_EXCEEDS_PRICE',
        message: 'Le minimum de versement ne peut pas depasser le prix.',
      });
    }
  }

  async create(data: {
    name: string;
    slug: string;
    description?: string;
    priceXof: number;
    minimumPaymentXof: number;
    startAt: string;
    endAt: string;
    capacity?: number;
    status?: SprintStatus;
  }) {
    this.checkAmounts(data.priceXof, data.minimumPaymentXof);
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
  listPublic(page = 1, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    return this.listWhere(
      { status: { in: [SprintStatus.ACTIVE, SprintStatus.INACTIVE] } },
      skip,
      take,
    );
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
    return sprint;
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
      startAt: string;
      endAt: string;
      capacity: number | null;
    }>,
  ) {
    const sprint = await this.detail(id);
    const priceXof = data.priceXof ?? sprint.priceXof;
    const minimum = data.minimumPaymentXof ?? sprint.minimumPaymentXof;
    this.checkAmounts(priceXof, minimum);
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

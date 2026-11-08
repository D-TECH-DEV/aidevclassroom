import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EnrollmentStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { hashTrackingToken } from '../common/guards/tracking-token.guard';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeStudentInput } from '../students/students.service';
import { remainingAmountXof, totalPaidXof } from '../payments/balance.util';

/**
 * Transitions permises (RG07) — l'etat d'inscription est separe de l'etat
 * des paiements : un paiement echoue n'annule jamais l'inscription.
 * COMPLETED = inscription soldee ET validee par un admin (ne signifie pas
 * "sprint termine" pedagogiquement).
 */
export const ENROLLMENT_TRANSITIONS: Record<
  EnrollmentStatus,
  EnrollmentStatus[]
> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  CANCELLED: [],
  COMPLETED: [],
};

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    sprintId: number,
    studentInput: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    },
    planInput?: string,
    partnerInput?: { firstName?: string; lastName?: string; phone?: string },
  ) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
    });
    if (!sprint) {
      throw new NotFoundException({
        code: 'SPRINT_NOT_FOUND',
        message: 'Sprint introuvable.',
      });
    }
    if (sprint.status !== 'ACTIVE') {
      throw new UnprocessableEntityException({
        code: 'SPRINT_NOT_ACTIVE',
        message: "Ce Sprint n'accepte pas de nouvelles inscriptions.",
      });
    }
    const plan = (planInput ?? 'SINGLE').toUpperCase();
    if (plan !== 'SINGLE' && plan !== 'DUO') {
      throw new BadRequestException({
        code: 'INVALID_PLAN',
        message: 'Forfait inconnu : SINGLE ou DUO.',
      });
    }
    const sprintDuo = sprint as typeof sprint & {
      duoPriceXof?: number | null;
    };
    if (plan === 'DUO' && sprintDuo.duoPriceXof == null) {
      throw new UnprocessableEntityException({
        code: 'DUO_NOT_AVAILABLE',
        message: 'Le forfait duo est indisponible pour ce Sprint.',
      });
    }
    const partnerFirstName = partnerInput?.firstName?.trim() ?? '';
    const partnerLastName = partnerInput?.lastName?.trim() ?? '';
    const partnerPhone = (partnerInput?.phone ?? '').replace(/[\s-]/g, '');
    if (
      plan === 'DUO' &&
      (partnerFirstName.length < 2 ||
        partnerLastName.length < 2 ||
        !/^\+[1-9]\d{6,17}$/.test(partnerPhone))
    ) {
      throw new BadRequestException({
        code: 'PARTNER_REQUIRED',
        message:
          'Le nom et le numero du binome sont requis pour le forfait duo.',
      });
    }
    // RG04 : prix fige selon le forfait choisi.
    const total =
      plan === 'DUO' ? (sprintDuo.duoPriceXof as number) : sprint.priceXof;
    const seatsNeeded = plan === 'DUO' ? 2 : 1;
    const n = normalizeStudentInput(studentInput);
    // Capacite + doublon + creation dans une transaction (RG14, anti-concurrence).
    // Un dossier DUO occupe 2 places.
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (sprint.capacity != null) {
          const rows = await tx.enrollment.findMany({
            where: { sprintId, status: { not: 'CANCELLED' } },
            select: { plan: true },
          });
          const used = rows.reduce(
            (s, r) => s + ((r as { plan?: string }).plan === 'DUO' ? 2 : 1),
            0,
          );
          if (used + seatsNeeded > sprint.capacity) {
            throw new ConflictException({
              code: 'SPRINT_CAPACITY_REACHED',
              message: 'Ce Sprint a atteint sa capacite maximale.',
            });
          }
        }
        let student = await tx.student.findUnique({
          where: { email: n.email },
        });
        if (!student) {
          student = await tx.student.create({ data: n });
        }
        const dup = await tx.enrollment.findUnique({
          where: { studentId_sprintId: { studentId: student.id, sprintId } },
        });
        if (dup) {
          throw new ConflictException({
            code: 'DUPLICATE_ENROLLMENT',
            message: 'Ce participant est deja inscrit a ce Sprint.',
          });
        }
        const trackingToken = randomBytes(32).toString('hex');
        const enrollment = await tx.enrollment.create({
          data: {
            studentId: student.id,
            sprintId,
            totalAmountXof: total,
            plan: plan,
            partnerFirstName: plan === 'DUO' ? partnerFirstName : null,
            partnerLastName: plan === 'DUO' ? partnerLastName : null,
            partnerPhone: plan === 'DUO' ? partnerPhone : null,
            status: 'PENDING',
            trackingTokenHash: hashTrackingToken(trackingToken),
          },
          include: { student: true, sprint: true },
        });
        return { enrollment, trackingToken };
      });
      return result;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'DUPLICATE_ENROLLMENT',
          message: 'Ce participant est deja inscrit a ce Sprint.',
        });
      }
      throw e;
    }
  }

  /**
   * Retrouve les dossiers d'un e-mail et re-emet un jeton de suivi par
   * dossier (rotation). Le jeton d'origine n'est stocke que hache et ne
   * peut pas etre relu : on en genere un nouveau et on remplace le hash.
   * Sans OTP, quiconque connait l'e-mail obtient l'acces — assume.
   */
  async findByEmail(email: string) {
    const clean = email.trim().toLowerCase();
    const student = await this.prisma.student.findUnique({
      where: { email: clean },
    });
    if (!student) {
      return { dossiers: [] };
    }
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: student.id },
      include: {
        sprint: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            minimumPaymentXof: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amountXof: true,
            currency: true,
            reference: true,
            status: true,
            authorizationUrl: true,
            paidAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const dossiers = await Promise.all(
      enrollments.map(async (e) => {
        const trackingToken = randomBytes(32).toString('hex');
        await this.prisma.enrollment.update({
          where: { id: e.id },
          data: { trackingTokenHash: hashTrackingToken(trackingToken) },
        });
        const { trackingTokenHash, studentId, ...rest } = e;
        void trackingTokenHash;
        void studentId;
        return { ...this.withBalance(rest), trackingToken };
      }),
    );
    return { dossiers };
  }

  async listAdmin(
    page = 1,
    limit = 20,
    filters: {
      sprintId?: number;
      status?: EnrollmentStatus;
      search?: string;
    } = {},
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where: Prisma.EnrollmentWhereInput = {
      ...(filters.sprintId ? { sprintId: filters.sprintId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            student: {
              OR: [
                { firstName: { contains: filters.search } },
                { lastName: { contains: filters.search } },
                { email: { contains: filters.search } },
              ],
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          student: true,
          sprint: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              minimumPaymentXof: true,
            },
          },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    const enriched = items.map((e) => this.withBalance(e));
    return {
      items: enriched,
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
    };
  }

  withBalance<
    T extends {
      totalAmountXof: number;
      payments: { status: string; amountXof: number }[];
    },
  >(e: T) {
    const totalPaid = totalPaidXof(e.payments);
    return {
      ...e,
      totalPaidXof: totalPaid,
      remainingAmountXof: remainingAmountXof(e.totalAmountXof, e.payments),
    };
  }

  async detailAdmin(id: number) {
    const e = await this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        student: true,
        sprint: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!e) {
      throw new NotFoundException({
        code: 'ENROLLMENT_NOT_FOUND',
        message: 'Inscription introuvable.',
      });
    }
    return this.withBalance(e);
  }

  /** Resume minimal protege par jeton de suivi (RG16). */
  async statusForParticipant(id: number) {
    const e = await this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        sprint: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            minimumPaymentXof: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amountXof: true,
            currency: true,
            reference: true,
            status: true,
            authorizationUrl: true,
            paidAt: true,
            createdAt: true,
          },
        },
      },
    });
    if (!e) {
      throw new NotFoundException({
        code: 'ENROLLMENT_NOT_FOUND',
        message: 'Inscription introuvable.',
      });
    }
    const { trackingTokenHash, studentId, ...rest } = e;
    void trackingTokenHash;
    void studentId;
    return this.withBalance(rest);
  }

  async changeStatus(id: number, status: EnrollmentStatus) {
    const e = await this.prisma.enrollment.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!e) {
      throw new NotFoundException({
        code: 'ENROLLMENT_NOT_FOUND',
        message: 'Inscription introuvable.',
      });
    }
    const allowed = ENROLLMENT_TRANSITIONS[e.status];
    if (e.status !== status && !allowed.includes(status)) {
      throw new BadRequestException({
        code: 'INVALID_ENROLLMENT_TRANSITION',
        message: `Transition de ${e.status} vers ${status} non permise.`,
      });
    }
    if (status === 'COMPLETED') {
      const remaining = remainingAmountXof(e.totalAmountXof, e.payments);
      if (remaining > 0) {
        throw new BadRequestException({
          code: 'ENROLLMENT_NOT_SETTLED',
          message: 'Solde restant non nul : impossible de cloturer.',
        });
      }
    }
    return this.prisma.enrollment.update({ where: { id }, data: { status } });
  }

  async paymentsOf(id: number) {
    await this.detailAdmin(id);
    return this.prisma.payment.findMany({
      where: { enrollmentId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
}

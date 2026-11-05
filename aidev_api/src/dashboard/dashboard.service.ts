import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tous les chiffres viennent de PostgreSQL (RG15) : SUCCESS uniquement pour les encaissements. */
  async summary() {
    const [
      totalStudents,
      activeSprints,
      enrollments,
      collectedAgg,
      pendingAgg,
      recentEnrollments,
      recentPayments,
    ] = await Promise.all([
      this.prisma.student.count(),
      this.prisma.sprint.count({ where: { status: 'ACTIVE' } }),
      this.prisma.enrollment.findMany({
        where: { status: { not: 'CANCELLED' } },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          sprint: { select: { id: true, name: true, slug: true } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      }),
      this.prisma.payment.aggregate({
        _sum: { amountXof: true },
        _count: true,
        where: { status: 'SUCCESS' },
      }),
      this.prisma.payment.aggregate({
        _sum: { amountXof: true },
        _count: true,
        where: { status: 'PENDING' },
      }),
      this.prisma.enrollment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          sprint: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          enrollment: {
            select: {
              id: true,
              student: {
                select: { firstName: true, lastName: true, email: true },
              },
              sprint: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    let outstanding = 0;
    for (const e of enrollments) {
      const paid = e.payments
        .filter((p) => p.status === 'SUCCESS')
        .reduce((s, p) => s + p.amountXof, 0);
      outstanding += Math.max(0, e.totalAmountXof - paid);
    }
    return {
      totalStudents,
      activeSprints,
      totalEnrollments: enrollments.length,
      totalCollectedXof: collectedAgg._sum.amountXof ?? 0,
      totalOutstandingXof: outstanding,
      pendingPayments: {
        count: pendingAgg._count,
        amountXof: pendingAgg._sum.amountXof ?? 0,
      },
      recentEnrollments,
      recentPayments,
    };
  }

  recentEnrollments(limit = 10) {
    return this.prisma.enrollment.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        sprint: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  recentPayments(limit = 10) {
    return this.prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      include: {
        enrollment: {
          select: {
            id: true,
            student: {
              select: { firstName: true, lastName: true, email: true },
            },
            sprint: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async collections(from?: string, to?: string) {
    const where = {
      status: 'SUCCESS' as const,
      ...(from || to
        ? {
            paidAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };
    const [agg, byDay] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amountXof: true },
        _count: true,
        where,
      }),
      this.prisma.$queryRaw<{ day: string; total: number; count: number }[]>`
        SELECT TO_CHAR(DATE("paid_at"), 'YYYY-MM-DD') AS day, SUM("amount_xof")::int AS total, COUNT(*)::int AS count
        FROM "payments"
        WHERE "status" = 'SUCCESS'
        GROUP BY DATE("paid_at")
        ORDER BY day DESC
        LIMIT 30
      `.catch(() => [] as { day: string; total: number; count: number }[]),
    ]);
    return {
      totalXof: agg._sum.amountXof ?? 0,
      count: agg._count,
      byDay,
    };
  }

  async outstandingBalances(page = 1, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const enrollments = await this.prisma.enrollment.findMany({
      where: { status: { not: 'CANCELLED' } },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        sprint: { select: { id: true, name: true, slug: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
    const total = await this.prisma.enrollment.count({
      where: { status: { not: 'CANCELLED' } },
    });
    const items = enrollments
      .map((e) => {
        const paid = e.payments
          .filter((p) => p.status === 'SUCCESS')
          .reduce((s, p) => s + p.amountXof, 0);
        return {
          enrollmentId: e.id,
          student: e.student,
          sprint: e.sprint,
          status: e.status,
          totalAmountXof: e.totalAmountXof,
          totalPaidXof: paid,
          remainingAmountXof: Math.max(0, e.totalAmountXof - paid),
        };
      })
      .filter((i) => i.remainingAmountXof > 0);
    return { items, total, page: Math.floor(skip / take) + 1, limit: take };
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { remainingAmountXof, totalPaidXof } from '../payments/balance.util';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tous les chiffres viennent de PostgreSQL (RG15) : SUCCESS uniquement pour les encaissements. */
  async summary() {
    const [
      totalStudents,
      activeSprints,
      totalEnrollments,
      outstandingRows,
      collectedAgg,
      pendingAgg,
      recentEnrollments,
      recentPayments,
    ] = await Promise.all([
      this.prisma.student.count({
        where: { enrollments: { some: { status: { not: 'CANCELLED' } } } },
      }),
      this.prisma.sprint.count({ where: { status: 'ACTIVE' } }),
      this.prisma.enrollment.count({ where: { status: { not: 'CANCELLED' } } }),
      this.prisma.$queryRaw<{ outstanding: bigint | number | string }[]>`
        SELECT COALESCE(
          SUM(GREATEST(0, e."total_amount_xof" - COALESCE(p.paid, 0))),
          0
        )::bigint AS outstanding
        FROM "enrollments" e
        LEFT JOIN (
          SELECT "enrollment_id", SUM("amount_xof") AS paid
          FROM "payments"
          WHERE "status" = 'SUCCESS'
          GROUP BY "enrollment_id"
        ) p ON p."enrollment_id" = e."id"
        WHERE e."status" <> 'CANCELLED'
      `,
      this.prisma.payment.aggregate({
        _sum: { amountXof: true },
        _count: true,
        where: {
          status: 'SUCCESS',
          enrollment: { status: { not: 'CANCELLED' } },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amountXof: true },
        _count: true,
        where: {
          status: 'PENDING',
          enrollment: { status: { not: 'CANCELLED' } },
        },
      }),
      this.prisma.enrollment.findMany({
        where: { status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          sprint: { select: { id: true, name: true, slug: true } },
          payments: { select: { status: true, amountXof: true } },
        },
      }),
      this.prisma.payment.findMany({
        where: { enrollment: { status: { not: 'CANCELLED' } } },
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

    const outstanding = Number(outstandingRows[0]?.outstanding ?? 0);
    return {
      totalStudents,
      activeSprints,
      totalEnrollments,
      totalCollectedXof: collectedAgg._sum.amountXof ?? 0,
      totalOutstandingXof: outstanding,
      pendingPayments: {
        count: pendingAgg._count,
        amountXof: pendingAgg._sum.amountXof ?? 0,
      },
      recentEnrollments: recentEnrollments.map((e) => ({
        ...e,
        totalPaidXof: totalPaidXof(e.payments),
        remainingAmountXof: remainingAmountXof(e.totalAmountXof, e.payments),
      })),
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
    const parsedFrom = from ? new Date(from) : null;
    const parsedTo = to ? new Date(to) : null;
    const validFrom =
      parsedFrom && !Number.isNaN(parsedFrom.getTime()) ? parsedFrom : null;
    const validTo =
      parsedTo && !Number.isNaN(parsedTo.getTime()) ? parsedTo : null;

    const where = {
      status: 'SUCCESS' as const,
      enrollment: { status: { not: 'CANCELLED' as const } },
      ...(validFrom || validTo
        ? {
            paidAt: {
              ...(validFrom ? { gte: validFrom } : {}),
              ...(validTo ? { lte: validTo } : {}),
            },
          }
        : {}),
    };
    const fromClause = validFrom
      ? Prisma.sql`AND p."paid_at" >= ${validFrom}`
      : Prisma.empty;
    const toClause = validTo
      ? Prisma.sql`AND p."paid_at" <= ${validTo}`
      : Prisma.empty;

    const [agg, byDay] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amountXof: true },
        _count: true,
        where,
      }),
      this.prisma.$queryRaw<{ day: string; total: number; count: number }[]>`
        SELECT TO_CHAR(DATE(p."paid_at"), 'YYYY-MM-DD') AS day, SUM(p."amount_xof")::int AS total, COUNT(*)::int AS count
        FROM "payments" p
        INNER JOIN "enrollments" e ON e."id" = p."enrollment_id"
        WHERE p."status" = 'SUCCESS'
          AND e."status" <> 'CANCELLED'
          ${fromClause}
          ${toClause}
        GROUP BY DATE(p."paid_at")
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

  async outstandingBalances(page = 1, limit = 50) {
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

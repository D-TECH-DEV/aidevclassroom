import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export function normalizeStudentInput<
  T extends {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  },
>(d: T): T {
  return {
    ...d,
    email: d.email.trim().toLowerCase(),
    firstName: d.firstName.trim(),
    lastName: d.lastName.trim(),
    phone: d.phone.replace(/[\s-]/g, ''),
  };
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creation publique : ne revele jamais aucune PII ni l'existence d'un e-mail. */
  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }): Promise<{ id: number }> {
    const n = normalizeStudentInput(data);
    const existing = await this.prisma.student.findUnique({
      where: { email: n.email },
      select: { id: true },
    });
    if (existing) {
      return { id: existing.id };
    }
    try {
      const student = await this.prisma.student.create({
        data: n,
        select: { id: true },
      });
      return { id: student.id };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const found = await this.prisma.student.findUnique({
          where: { email: n.email },
          select: { id: true },
        });
        return { id: found!.id };
      }
      throw e;
    }
  }

  async listAdmin(page = 1, limit = 50, search?: string) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const tokens = (search ?? '')
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    const where: Prisma.StudentWhereInput =
      tokens.length > 0
        ? {
            AND: tokens.map((token) => ({
              OR: [
                { firstName: { contains: token, mode: 'insensitive' } },
                { lastName: { contains: token, mode: 'insensitive' } },
                { email: { contains: token, mode: 'insensitive' } },
                { phone: { contains: token, mode: 'insensitive' } },
              ],
            })),
          }
        : {};
    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.student.count({ where }),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, limit: take };
  }

  async detailAdmin(id: number) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException({
        code: 'STUDENT_NOT_FOUND',
        message: 'Participant introuvable.',
      });
    }
    return student;
  }

  async updateAdmin(
    id: number,
    data: { firstName?: string; lastName?: string; phone?: string },
  ) {
    await this.detailAdmin(id);
    const clean: Record<string, string> = {};
    if (data.firstName !== undefined) clean.firstName = data.firstName.trim();
    if (data.lastName !== undefined) clean.lastName = data.lastName.trim();
    if (data.phone !== undefined)
      clean.phone = data.phone.replace(/[\s-]/g, '');
    try {
      return await this.prisma.student.update({ where: { id }, data: clean });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'STUDENT_CONFLICT',
          message: 'Conflit de donnees participant.',
        });
      }
      throw e;
    }
  }

  async enrollmentsOf(id: number) {
    await this.detailAdmin(id);
    return this.prisma.enrollment.findMany({
      where: { studentId: id },
      include: {
        sprint: { select: { id: true, name: true, slug: true, status: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

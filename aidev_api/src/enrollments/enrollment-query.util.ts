import { BadRequestException } from '@nestjs/common';
import { EnrollmentStatus, Prisma } from '@prisma/client';

export type AdminEnrollmentFilters = {
  sprintId?: number;
  status?: EnrollmentStatus;
  search?: string;
};

export const PARTICIPANT_SPRINT_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
  minimumPaymentXof: true,
} as const;

export const PARTICIPANT_PAYMENTS_SELECT = {
  id: true,
  amountXof: true,
  currency: true,
  reference: true,
  status: true,
  authorizationUrl: true,
  paidAt: true,
  createdAt: true,
} as const;

export const ADMIN_ENROLLMENT_INCLUDE = {
  student: true,
  sprint: { select: PARTICIPANT_SPRINT_SELECT },
  payments: { orderBy: { createdAt: 'desc' as const } },
} as const;

export function buildAdminEnrollmentWhere(
  filters: AdminEnrollmentFilters,
): Prisma.EnrollmentWhereInput {
  const tokens = (filters.search ?? '')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  return {
    ...(filters.sprintId ? { sprintId: filters.sprintId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(tokens.length > 0
      ? {
          AND: tokens.map((token) => ({
            student: {
              OR: [
                { firstName: { contains: token, mode: 'insensitive' } },
                { lastName: { contains: token, mode: 'insensitive' } },
                { email: { contains: token, mode: 'insensitive' } },
                { phone: { contains: token, mode: 'insensitive' } },
              ],
            },
          })),
        }
      : {}),
  };
}

export function validateDuoPartner(
  plan: string,
  partnerInput?: { firstName?: string; lastName?: string; phone?: string },
) {
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

  return { partnerFirstName, partnerLastName, partnerPhone };
}

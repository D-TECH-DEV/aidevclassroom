import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function checkSprintAmounts(
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

export function normalizeOptionalText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeModules(
  modules?: string[] | null,
): string[] | null {
  if (!modules) return null;
  const cleaned = modules
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);
  return cleaned.length > 0 ? cleaned : null;
}

export function buildSprintUpdateData(
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
  startAt: Date,
  endAt: Date,
): Prisma.SprintUpdateInput {
  return {
    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.priceXof !== undefined ? { priceXof: data.priceXof } : {}),
    ...(data.minimumPaymentXof !== undefined
      ? { minimumPaymentXof: data.minimumPaymentXof }
      : {}),
    ...(data.duoPriceXof !== undefined ? { duoPriceXof: data.duoPriceXof } : {}),
    ...(data.duoMinimumPaymentXof !== undefined
      ? { duoMinimumPaymentXof: data.duoMinimumPaymentXof }
      : {}),
    ...(data.startAt !== undefined ? { startAt } : {}),
    ...(data.endAt !== undefined ? { endAt } : {}),
    ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
    ...(data.city !== undefined ? { city: normalizeOptionalText(data.city) } : {}),
    ...(data.location !== undefined
      ? { location: normalizeOptionalText(data.location) }
      : {}),
    ...(data.format !== undefined
      ? { format: normalizeOptionalText(data.format) }
      : {}),
    ...(data.level !== undefined
      ? { level: normalizeOptionalText(data.level) }
      : {}),
    ...(data.modules !== undefined
      ? { modules: normalizeModules(data.modules) ?? Prisma.JsonNull }
      : {}),
  };
}

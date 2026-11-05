/** Logique pure de solde (RG05/RG06) — testee unitairement sans DB. */

export interface PaidLike {
  status: string;
  amountXof: number;
}

export function totalPaidXof(payments: PaidLike[]): number {
  return payments
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + p.amountXof, 0);
}

export function remainingAmountXof(
  totalAmountXof: number,
  payments: PaidLike[],
): number {
  const remaining = totalAmountXof - totalPaidXof(payments);
  return Math.max(0, remaining);
}

export type AmountErrorCode =
  | 'PAYMENT_AMOUNT_INVALID'
  | 'PAYMENT_AMOUNT_BELOW_MINIMUM'
  | 'PAYMENT_AMOUNT_EXCEEDS_BALANCE'
  | 'ENROLLMENT_ALREADY_SETTLED';

/** Valide un montant libre encadre (RG03). Retourne null si valide. */
export function validatePaymentAmount(
  amountXof: unknown,
  minimumPaymentXof: number,
  remaining: number,
): AmountErrorCode | null {
  if (
    typeof amountXof !== 'number' ||
    !Number.isInteger(amountXof) ||
    amountXof <= 0
  ) {
    return 'PAYMENT_AMOUNT_INVALID';
  }
  if (remaining <= 0) return 'ENROLLMENT_ALREADY_SETTLED';
  if (amountXof < minimumPaymentXof) return 'PAYMENT_AMOUNT_BELOW_MINIMUM';
  if (amountXof > remaining) return 'PAYMENT_AMOUNT_EXCEEDS_BALANCE';
  return null;
}

export const AMOUNT_ERROR_MESSAGES: Record<AmountErrorCode, string> = {
  PAYMENT_AMOUNT_INVALID: 'Le montant doit etre un entier positif en XOF.',
  PAYMENT_AMOUNT_BELOW_MINIMUM:
    'Le montant est inferieur au minimum de versement du Sprint.',
  PAYMENT_AMOUNT_EXCEEDS_BALANCE: 'Le montant depasse le solde restant.',
  ENROLLMENT_ALREADY_SETTLED:
    'Cette inscription est deja integralement reglee.',
};

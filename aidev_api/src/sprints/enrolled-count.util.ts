/**
 * Comptage des inscrits (site public).
 *
 * Defini comme : un dossier d'inscription non annule dont le total des
 * versements `SUCCESS` atteint le minimum du sprint. Le seuil suit la meme
 * regle que l'initialisation d'un versement : un dossier `DUO` utilise le
 * minimum duo quand il est defini, sinon le minimum solo.
 *
 * Un dossier DUO qualifie vaut 2 personnes (2 places de capacite) mais
 * 1 seul dossier : `enrolledSeats` nourrit la jauge `inscrits / quota`,
 * `enrolledCount` compte les dossiers.
 */

export interface EnrollablePayment {
  status: string;
  amountXof: number;
}

export interface EnrollableRow {
  plan?: string | null;
  status: string;
  payments: EnrollablePayment[];
}

/** Seuil applicable a un dossier selon son forfait. */
export function thresholdForEnrollment(
  plan: string | null | undefined,
  minimumPaymentXof: number,
  duoMinimumPaymentXof: number | null | undefined,
): number {
  if (
    String(plan ?? 'SINGLE').toUpperCase() === 'DUO' &&
    duoMinimumPaymentXof != null
  ) {
    return duoMinimumPaymentXof;
  }
  return minimumPaymentXof;
}

/** Total encaisse : seuls les paiements SUCCESS comptent. */
export function totalPaidSuccess(payments: EnrollablePayment[]): number {
  return payments
    .filter((p) => p.status === 'SUCCESS')
    .reduce((somme, p) => somme + p.amountXof, 0);
}

/** Un dossier annule ne compte jamais, quel que soit son solde. */
export function isEnrolled(
  row: EnrollableRow,
  minimumPaymentXof: number,
  duoMinimumPaymentXof: number | null | undefined,
): boolean {
  if (row.status === 'CANCELLED') return false;
  return (
    totalPaidSuccess(row.payments) >=
    thresholdForEnrollment(row.plan, minimumPaymentXof, duoMinimumPaymentXof)
  );
}

export interface EnrolledSummary {
  /** Dossiers qualifies (minimum atteint). */
  enrolledCount: number;
  /** Personnes inscrites (un DUO qualifie = 2). */
  enrolledSeats: number;
}

/** Agrege dossiers et personnes sur un lot de dossiers non annules ou non. */
export function countEnrolled(
  rows: EnrollableRow[],
  minimumPaymentXof: number,
  duoMinimumPaymentXof: number | null | undefined,
): EnrolledSummary {
  let enrolledCount = 0;
  let enrolledSeats = 0;
  for (const row of rows) {
    if (!isEnrolled(row, minimumPaymentXof, duoMinimumPaymentXof)) continue;
    enrolledCount += 1;
    enrolledSeats +=
      String(row.plan ?? 'SINGLE').toUpperCase() === 'DUO' ? 2 : 1;
  }
  return { enrolledCount, enrolledSeats };
}

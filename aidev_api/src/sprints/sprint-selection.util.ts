export interface SelectionEnrollmentInput {
  id: number;
  plan: string;
  status: string;
  totalAmountXof: number;
  paidXof: number;
  firstPaidAt: Date | null;
  createdAt: Date;
  student: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

export interface SelectionEntry {
  rank: number;
  enrollmentId: number;
  studentId: number;
  studentName: string;
  email: string;
  phone: string;
  plan: string;
  seats: number;
  status: string;
  totalAmountXof: number;
  paidXof: number;
  remainingXof: number;
  paidPercent: number;
  refundableTwoThirdsXof: number;
  firstPaidAt: string | null;
  createdAt: string;
}

export interface SprintSelectionResult {
  capacity: number | null;
  seatsUsed: number;
  seatsRemaining: number | null;
  selectedCount: number;
  waitlistCount: number;
  unpaidCount: number;
  totalRefundableTwoThirdsXof: number;
  selected: SelectionEntry[];
  waitlist: SelectionEntry[];
  unpaid: SelectionEntry[];
}

function toPercent(paidXof: number, totalAmountXof: number): number {
  if (totalAmountXof <= 0) return paidXof > 0 ? 100 : 0;
  return Math.min(100, Math.round((paidXof / totalAmountXof) * 100));
}

function toExactRatio(paidXof: number, totalAmountXof: number): number {
  if (totalAmountXof <= 0) return paidXof > 0 ? 1 : 0;
  return Math.min(1, paidXof / totalAmountXof);
}

function mapEntry(
  row: SelectionEnrollmentInput,
  rank: number,
): SelectionEntry {
  const seats = row.plan === 'DUO' ? 2 : 1;
  const remainingXof = Math.max(0, row.totalAmountXof - row.paidXof);
  const refundableTwoThirdsXof =
    row.paidXof > 0 ? Math.round((row.paidXof * 2) / 3) : 0;
  return {
    rank,
    enrollmentId: row.id,
    studentId: row.student.id,
    studentName:
      `${row.student.firstName} ${row.student.lastName}`.trim() ||
      'Participant',
    email: row.student.email,
    phone: row.student.phone,
    plan: row.plan,
    seats,
    status: row.status,
    totalAmountXof: row.totalAmountXof,
    paidXof: row.paidXof,
    remainingXof,
    paidPercent: toPercent(row.paidXof, row.totalAmountXof),
    refundableTwoThirdsXof,
    firstPaidAt: row.firstPaidAt ? row.firstPaidAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Classe et sélectionne les adhérents d'un sprint :
 * - Priorité exclusive : pourcentage payé décroissant (égalité départagée par ancienneté).
 * - DUO = 2 places, SOLO/SINGLE = 1 place.
 * - Les dossiers à 0 FCFA sont placés à part dans `unpaid`.
 * - Les non-retenus disposent du calcul des 2/3 remboursables.
 */
export function computeSprintSelection(
  enrollments: SelectionEnrollmentInput[],
  capacity: number | null,
): SprintSelectionResult {
  const active = enrollments.filter((e) => e.status !== 'CANCELLED');
  const eligible = active.filter((e) => e.paidXof > 0);
  const unpaidRows = active
    .filter((e) => e.paidXof <= 0)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  eligible.sort((a, b) => {
    const ratioDiff =
      toExactRatio(b.paidXof, b.totalAmountXof) -
      toExactRatio(a.paidXof, a.totalAmountXof);
    if (Math.abs(ratioDiff) > 1e-9) return ratioDiff;

    const timeA = (a.firstPaidAt ?? a.createdAt).getTime();
    const timeB = (b.firstPaidAt ?? b.createdAt).getTime();
    if (timeA !== timeB) return timeA - timeB;

    return a.id - b.id;
  });

  const selected: SelectionEntry[] = [];
  const waitlist: SelectionEntry[] = [];
  let seatsUsed = 0;

  eligible.forEach((row, index) => {
    const entry = mapEntry(row, index + 1);
    if (capacity === null || seatsUsed + entry.seats <= capacity) {
      seatsUsed += entry.seats;
      selected.push(entry);
    } else {
      waitlist.push(entry);
    }
  });

  const unpaid = unpaidRows.map((row, index) => mapEntry(row, index + 1));
  const totalRefundableTwoThirdsXof = waitlist.reduce(
    (sum, item) => sum + item.refundableTwoThirdsXof,
    0,
  );

  return {
    capacity,
    seatsUsed,
    seatsRemaining: capacity === null ? null : Math.max(0, capacity - seatsUsed),
    selectedCount: selected.length,
    waitlistCount: waitlist.length,
    unpaidCount: unpaid.length,
    totalRefundableTwoThirdsXof,
    selected,
    waitlist,
    unpaid,
  };
}

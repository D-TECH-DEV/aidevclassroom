export type EnrollmentExportRow = {
  id: number;
  status: string;
  plan?: string;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
  partnerPhone?: string | null;
  totalAmountXof: number;
  totalPaidXof: number;
  remainingAmountXof: number;
  createdAt: Date | string;
  student?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  sprint?: { name?: string | null } | null;
};

export type PaymentExportRow = {
  id: number;
  reference: string;
  status: string;
  amountXof: number;
  currency?: string | null;
  paidAt?: Date | string | null;
  createdAt: Date | string;
  enrollmentId: number;
  enrollment?: {
    student?: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    } | null;
    sprint?: { name?: string | null } | null;
  } | null;
};

export const EXPORT_COLORS = {
  bgDark: 'FF010101',
  surfaceDark: 'FF010F06',
  accentGreen: 'FF2EE66B',
  white: 'FFFFFFFF',
  muted: 'FF9CA3AF',
  rowAlt: 'FFF4F7F5',
  borderLight: 'FFDCE3DF',
  textDark: 'FF111827',
  statusOkBg: 'FFDCFCE7',
  statusOkFg: 'FF14532D',
  statusWarnBg: 'FFFEF3C7',
  statusWarnFg: 'FF78350F',
  statusErrBg: 'FFFEE2E2',
  statusErrFg: 'FF7F1D1D',
} as const;

export const PDF_COLORS = {
  bgDark: '#010101',
  surfaceDark: '#010F06',
  accentGreen: '#2EE66B',
  accentBlue: '#0B63F6',
  white: '#FFFFFF',
  muted: '#9CA3AF',
  rowAlt: '#F4F7F5',
  borderLight: '#DCE3DF',
  textDark: '#111827',
  statusOkBg: '#DCFCE7',
  statusOkFg: '#14532D',
  statusWarnBg: '#FEF3C7',
  statusWarnFg: '#78350F',
  statusErrBg: '#FEE2E2',
  statusErrFg: '#7F1D1D',
} as const;

export const ENROLLMENT_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

export const PAYMENT_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  SUCCESS: 'Réussi',
  FAILED: 'Échoué',
  ABANDONED: 'Abandonné',
};

export function statusColorsArgb(status: string): { bg: string; fg: string } {
  if (status === 'CONFIRMED' || status === 'COMPLETED' || status === 'SUCCESS') {
    return { bg: EXPORT_COLORS.statusOkBg, fg: EXPORT_COLORS.statusOkFg };
  }
  if (status === 'PENDING') {
    return { bg: EXPORT_COLORS.statusWarnBg, fg: EXPORT_COLORS.statusWarnFg };
  }
  return { bg: EXPORT_COLORS.statusErrBg, fg: EXPORT_COLORS.statusErrFg };
}

export function statusColorsHex(status: string): { bg: string; fg: string } {
  if (status === 'CONFIRMED' || status === 'COMPLETED' || status === 'SUCCESS') {
    return { bg: PDF_COLORS.statusOkBg, fg: PDF_COLORS.statusOkFg };
  }
  if (status === 'PENDING') {
    return { bg: PDF_COLORS.statusWarnBg, fg: PDF_COLORS.statusWarnFg };
  }
  return { bg: PDF_COLORS.statusErrBg, fg: PDF_COLORS.statusErrFg };
}

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim() || '—';
}

export function formatDateAbidjan(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Abidjan',
  }).format(date);
}

export function formatXof(value: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(value))} FCFA`;
}

export function sanitizeSpreadsheetCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function mapEnrollmentRow(r: EnrollmentExportRow) {
  return {
    id: r.id,
    participant: fullName(r.student?.firstName, r.student?.lastName),
    email: r.student?.email ?? '—',
    phone: r.student?.phone ?? '—',
    sprint: r.sprint?.name ?? '—',
    plan: r.plan === 'DUO' ? 'Duo (2)' : 'Solo (1)',
    partner:
      r.plan === 'DUO'
        ? fullName(r.partnerFirstName, r.partnerLastName)
        : '—',
    partnerPhone: r.plan === 'DUO' ? (r.partnerPhone ?? '—') : '—',
    statusRaw: r.status,
    statusLabel: ENROLLMENT_LABELS[r.status] ?? r.status,
    totalAmountXof: r.totalAmountXof,
    totalPaidXof: r.totalPaidXof,
    remainingAmountXof: r.remainingAmountXof,
    createdAt: new Date(r.createdAt),
  };
}

export function mapPaymentRow(r: PaymentExportRow) {
  return {
    id: r.id,
    reference: r.reference,
    statusRaw: r.status,
    statusLabel: PAYMENT_LABELS[r.status] ?? r.status,
    amountXof: r.amountXof,
    currency: r.currency ?? 'XOF',
    participant: fullName(
      r.enrollment?.student?.firstName,
      r.enrollment?.student?.lastName,
    ),
    email: r.enrollment?.student?.email ?? '—',
    sprint: r.enrollment?.sprint?.name ?? '—',
    enrollmentId: r.enrollmentId,
    paidAt: r.paidAt ? new Date(r.paidAt) : ('—' as const),
    createdAt: new Date(r.createdAt),
  };
}

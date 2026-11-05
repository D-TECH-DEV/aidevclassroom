/**
 * Les formes que renvoie l'API sur les routes d'administration.
 *
 * Tout ce qui est ici vient de `docs/api/` — `authentication.md`,
 * `enrollments.md`, `dashboard.md` et `endpoints.md`. Rien n'est deviné :
 * un champ que la doc décrit en prose sans schéma est marqué optionnel, et
 * l'affichage ne s'appuie jamais dessus pour dire l'essentiel.
 */

/** `EnrollmentStatus` côté Prisma. */
export type StatutInscription =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED";

/** `PaymentStatus` côté Prisma. */
export type StatutPaiement = "PENDING" | "SUCCESS" | "FAILED" | "ABANDONED";

/**
 * Les transitions que l'API accepte. Proposer un bouton qui mène à un
 * `400 INVALID_ENROLLMENT_TRANSITION` serait une promesse en l'air : on
 * n'affiche que ce qui peut réussir.
 *
 * `COMPLETED` exige en plus un solde à zéro (`ENROLLMENT_NOT_SETTLED`),
 * ce que la liste ne peut pas dire — c'est vérifié à l'affichage.
 */
export const TRANSITIONS: Record<StatutInscription, StatutInscription[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  CANCELLED: [],
  COMPLETED: [],
};

/** `SprintStatus` côté Prisma. */
export type StatutSprint = "DRAFT" | "ACTIVE" | "INACTIVE" | "COMPLETED";

/**
 * Les transitions que l'API accepte (`SPRINT_TRANSITIONS` côté back).
 * « Lancer » = `DRAFT` → `ACTIVE` (ou `INACTIVE` → `ACTIVE`).
 */
export const TRANSITIONS_SPRINT: Record<StatutSprint, StatutSprint[]> = {
  DRAFT: ["ACTIVE", "INACTIVE"],
  ACTIVE: ["INACTIVE", "COMPLETED"],
  INACTIVE: ["ACTIVE", "DRAFT"],
  COMPLETED: [],
};

export type Sprint = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  priceXof: number;
  minimumPaymentXof: number;
  startAt: string;
  endAt: string;
  capacity?: number | null;
  status: StatutSprint;
  createdAt?: string;
  updatedAt?: string;
};

export type Administrateur = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

export type Connexion = {
  accessToken: string;
  expiresIn: string;
  admin: Administrateur;
};

export type Etudiant = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
};

export type SprintResume = {
  id: number;
  name: string;
  slug?: string;
};

export type Paiement = {
  id: number;
  amountXof: number;
  currency?: string;
  reference: string;
  status: StatutPaiement;
  authorizationUrl?: string | null;
  paidAt?: string | null;
  createdAt?: string;
  enrollment?: Inscription;
};

export type Inscription = {
  id: number;
  status: StatutInscription;
  totalAmountXof: number;
  /** Somme des paiements `SUCCESS`. Présent sur liste, détail et statut. */
  totalPaidXof?: number;
  /** `max(0, total − payé)`. Même présence. */
  remainingAmountXof?: number;
  createdAt?: string;
  updatedAt?: string;
  student?: Etudiant;
  sprint?: SprintResume;
  payments?: Paiement[];
};

/** `GET /admin/dashboard/summary`. */
export type Resume = {
  totalStudents: number;
  activeSprints: number;
  totalEnrollments: number;
  totalCollectedXof: number;
  totalOutstandingXof: number;
  pendingPayments: { count: number; amountXof: number };
  recentEnrollments: Inscription[];
  recentPayments: Paiement[];
};

/* ── Affichage ───────────────────────────────────────────────────────── */

export const LIBELLE_INSCRIPTION: Record<StatutInscription, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
};

export const LIBELLE_PAIEMENT: Record<StatutPaiement, string> = {
  PENDING: "En attente",
  SUCCESS: "Réussi",
  FAILED: "Échoué",
  ABANDONED: "Abandonné",
};

export const LIBELLE_SPRINT: Record<StatutSprint, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Lancé",
  INACTIVE: "Inactif",
  COMPLETED: "Terminé",
};

/**
 * Le montant tel qu'on l'écrit partout : espace insécable fine entre les
 * milliers, et jamais de centimes — le XOF n'en a pas.
 */
export function montant(xof: number | undefined | null): string {
  if (typeof xof !== "number" || !Number.isFinite(xof)) return "—";
  return `${xof.toLocaleString("fr-FR")} FCFA`;
}

/** Une date lisible, ou un tiret. Jamais une date inventée. */
export function date(valeur: string | null | undefined): string {
  if (!valeur) return "—";
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Le nom complet d'un participant, sans inventer celui qui manque. */
export function nomEtudiant(etudiant: Etudiant | undefined): string {
  if (!etudiant) return "—";
  const complet = [etudiant.firstName, etudiant.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return complet.length > 0 ? complet : etudiant.email;
}

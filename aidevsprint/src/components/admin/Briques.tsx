import Link from "next/link";

import {
  LIBELLE_INSCRIPTION,
  LIBELLE_PAIEMENT,
  LIBELLE_SPRINT,
  type StatutInscription,
  type StatutPaiement,
  type StatutSprint,
} from "@/lib/admin/types";

/**
 * Les briques d'affichage du panneau d'administration.
 *
 * ── Pourquoi ça ne ressemble pas au site public ──────────────────────
 * Le site public vend une formation : il a une aurore, des badges 3D, un
 * dégradé signature. Ici on lit des chiffres et on cherche une ligne dans
 * une liste. Les règles de `docs/design.md` restent valables — `rem`,
 * échelle fluide, pas d'ombre ni de dégradé — mais l'intention change :
 * densité et lisibilité, pas séduction.
 *
 * Le dégradé signature n'apparaît nulle part ici : ses quatre
 * emplacements autorisés sont tous sur le site public.
 */

/* ── Texte ───────────────────────────────────────────────────────────── */

export function Surtitre({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-small uppercase tracking-[0.25em] text-accent">
      {children}
    </p>
  );
}

export function TitrePage({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mt-2 text-h2 font-bold leading-[1.1] tracking-tight">
      {children}
    </h1>
  );
}

/** Un message d'erreur d'action. Discret mais impossible à manquer. */
export function Alerte({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-field border border-fg/25 bg-surface
                 px-4 py-3 font-mono text-small text-fg/80"
    >
      {children}
    </p>
  );
}

/** Quand une liste est vide. On dit pourquoi, pas juste « rien ». */
export function Vide({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-[clamp(1rem,3vw,1.5rem)] py-[clamp(2rem,6svh,3rem)]
                  text-center text-body text-fg/50">
      {children}
    </p>
  );
}

/* ── Pastilles de statut ─────────────────────────────────────────────── */

/**
 * Pas de couleur par statut au hasard : le vert de la maison ne sert qu'à
 * ce qui est acquis — une inscription confirmée ou terminée, un paiement
 * réussi. Tout le reste reste neutre, parce qu'un rouge sur « en attente »
 * dirait un échec qui n'en est pas un.
 */
function pastille(acquis: boolean, mort: boolean) {
  if (acquis) return "border-accent/50 text-accent";
  if (mort) return "border-fg/20 text-fg/40";
  return "border-fg/25 text-fg/70";
}

export function PastilleInscription({ statut }: { statut: StatutInscription }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-pill border px-3 py-1
                  font-mono text-small ${pastille(
                    statut === "CONFIRMED" || statut === "COMPLETED",
                    statut === "CANCELLED",
                  )}`}
    >
      {LIBELLE_INSCRIPTION[statut] ?? statut}
    </span>
  );
}

export function PastilleSprint({ statut }: { statut: StatutSprint }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-pill border px-3 py-1
                  font-mono text-small ${pastille(
                    statut === "ACTIVE",
                    statut === "COMPLETED" || statut === "INACTIVE",
                  )}`}
    >
      {LIBELLE_SPRINT[statut] ?? statut}
    </span>
  );
}

export function PastillePaiement({ statut }: { statut: StatutPaiement }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-pill border px-3 py-1
                  font-mono text-small ${pastille(
                    statut === "SUCCESS",
                    statut === "FAILED" || statut === "ABANDONED",
                  )}`}
    >
      {LIBELLE_PAIEMENT[statut] ?? statut}
    </span>
  );
}

/* ── Tuiles de chiffres ──────────────────────────────────────────────── */

export function Tuile({
  libelle,
  valeur,
  precision,
}: {
  libelle: string;
  valeur: string;
  precision?: string;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-card border border-fg/15
                 bg-surface px-[clamp(1rem,3vw,1.5rem)]
                 py-[clamp(1rem,3svh,1.5rem)]"
    >
      <p className="font-mono text-small uppercase tracking-[0.15em] text-fg/50">
        {libelle}
      </p>
      <p className="text-h3 font-bold leading-none tracking-tight">{valeur}</p>
      {precision ? (
        <p className="font-mono text-small text-fg/45">{precision}</p>
      ) : null}
    </div>
  );
}

/* ── Cadres et tableaux ──────────────────────────────────────────────── */

export function Cadre({
  titre,
  action,
  children,
}: {
  titre: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-fg/15 bg-surface">
      <header
        className="flex flex-wrap items-center justify-between gap-3
                   border-b border-fg/10 px-[clamp(1rem,3vw,1.5rem)] py-4"
      >
        <h2 className="font-mono text-small uppercase tracking-[0.2em] text-fg/60">
          {titre}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/**
 * Un tableau qui garde toutes ses colonnes sur téléphone.
 *
 * Le défilement horizontal est volontaire : masquer des colonnes sous une
 * largeur donnée reviendrait à retirer de l'information sans le dire, ce
 * que les règles du projet interdisent. Ici rien ne disparaît — on fait
 * glisser.
 */
export function Tableau({
  entetes,
  children,
}: {
  entetes: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-fg/10">
            {entetes.map((e) => (
              <th
                key={e}
                scope="col"
                className="whitespace-nowrap px-[clamp(0.75rem,2vw,1.25rem)] py-3
                           font-mono text-small font-normal uppercase
                           tracking-[0.15em] text-fg/45"
              >
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Ligne({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-fg/[0.07] last:border-0">{children}</tr>
  );
}

export function Cellule({
  children,
  mono,
  sourd,
}: {
  children: React.ReactNode;
  mono?: boolean;
  sourd?: boolean;
}) {
  return (
    <td
      className={`px-[clamp(0.75rem,2vw,1.25rem)] py-3 align-middle text-small
                  ${mono ? "font-mono" : ""} ${sourd ? "text-fg/50" : "text-fg/85"}`}
    >
      {children}
    </td>
  );
}

/* ── Pagination ──────────────────────────────────────────────────────── */

/**
 * L'API ne renvoie pas de `totalPages`, seulement `total`, `page` et
 * `limit` — c'est noté tel quel dans sa doc. On le calcule donc ici.
 */
export function Pagination({
  base,
  page,
  limit,
  total,
  parametres,
}: {
  base: string;
  page: number;
  limit: number;
  total: number;
  parametres?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  if (pages <= 1) return null;

  const lien = (p: number) => {
    const q = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(parametres ?? {})) {
      if (valeur) q.set(cle, valeur);
    }
    q.set("page", String(p));
    return `${base}?${q}`;
  };

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4
                 border-t border-fg/10 px-[clamp(1rem,3vw,1.5rem)] py-4"
    >
      {page > 1 ? (
        <Link
          href={lien(page - 1)}
          className="rounded-field border border-fg/20 px-4 py-2
                     font-mono text-small text-fg/80"
        >
          ← Précédent
        </Link>
      ) : (
        <span />
      )}

      <p className="font-mono text-small text-fg/45">
        Page {page} sur {pages} · {total} au total
      </p>

      {page < pages ? (
        <Link
          href={lien(page + 1)}
          className="rounded-field border border-fg/20 px-4 py-2
                     font-mono text-small text-fg/80"
        >
          Suivant →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

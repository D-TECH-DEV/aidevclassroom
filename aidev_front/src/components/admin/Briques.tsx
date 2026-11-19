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

export function EnTetePage({
  surtitre,
  titre,
  description,
  action,
}: {
  surtitre: string;
  titre: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-end justify-between gap-4 border-b
                 border-fg/10 pb-6"
    >
      <div>
        <Surtitre>{surtitre}</Surtitre>
        <TitrePage>{titre}</TitrePage>
        {description ? (
          <p className="mt-3 max-w-[62ch] text-body text-fg/60">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
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
  icone,
  accent,
}: {
  libelle: string;
  valeur: string;
  precision?: React.ReactNode;
  icone?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="flex flex-col justify-between gap-3 rounded-card border
                 border-fg/15 bg-surface px-[clamp(1rem,2.5vw,1.5rem)]
                 py-[clamp(1rem,2.5svh,1.35rem)] transition-colors
                 hover:border-fg/25"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-h-[2rem] font-mono text-small uppercase tracking-[0.14em] text-fg/55">
          {libelle}
        </p>
        {icone ? (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center
                        rounded-field border ${
                          accent
                            ? "border-accent/35 bg-accent/10 text-accent"
                            : "border-fg/10 bg-bg/60 text-fg/60"
                        }`}
          >
            {icone}
          </span>
        ) : null}
      </div>
      <div>
        <p
          className={`whitespace-nowrap tabular-nums text-[clamp(1.35rem,2vw,1.75rem)] font-bold leading-none tracking-tight ${
            accent ? "text-accent" : "text-fg"
          }`}
        >
          {valeur}
        </p>
        {precision ? (
          <p className="mt-2 font-mono text-small text-fg/45">{precision}</p>
        ) : (
          <p className="mt-2 font-mono text-small text-transparent select-none">
            &nbsp;
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Cadres et tableaux ──────────────────────────────────────────────── */

export {
  Cadre,
  Tableau,
  Ligne,
  Cellule,
  Pagination,
} from "./BriquesTableau";

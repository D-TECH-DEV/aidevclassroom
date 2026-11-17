import Link from "next/link";

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
          <tr className="border-b border-fg/10 bg-bg/45">
            {entetes.map((e) => (
              <th
                key={e}
                scope="col"
                className="whitespace-nowrap px-[clamp(0.75rem,2vw,1.25rem)] py-3.5
                           font-mono text-small font-semibold uppercase
                           tracking-[0.15em] text-fg/55"
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
    <tr
      className="border-b border-fg/[0.07] transition-colors
                 hover:bg-fg/[0.03] last:border-0"
    >
      {children}
    </tr>
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

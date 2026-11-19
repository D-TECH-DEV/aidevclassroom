"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function FiltreStatutSprints({
  statuts,
  statutActuel,
}: {
  statuts: readonly { valeur: string; libelle: string }[];
  statutActuel?: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-small uppercase tracking-[0.15em] text-fg/45">
          Filtrer par statut
        </span>
        <select
          name="statut"
          value={statutActuel ?? ""}
          disabled={enCours}
          onChange={(e) => {
            const val = e.target.value;
            demarrer(() => {
              router.push(
                val ? `/admin/sprints?statut=${encodeURIComponent(val)}` : "/admin/sprints",
              );
            });
          }}
          className="rounded-field border border-fg/20 bg-bg px-3 py-2
                     font-mono text-small text-fg outline-none
                     focus-visible:border-accent/60 disabled:opacity-60"
        >
          <option value="">Tous les statuts</option>
          {statuts.map((s) => (
            <option key={s.valeur} value={s.valeur}>
              {s.libelle}
            </option>
          ))}
        </select>
      </label>
      {enCours ? (
        <span className="pb-2 font-mono text-xs text-fg/55">Filtrage…</span>
      ) : null}
    </div>
  );
}

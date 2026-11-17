import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  FilterHorizontalIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { LIBELLE_SPRINT, type StatutSprint } from "@/lib/admin/types";

const champ =
  "rounded-field border border-fg/20 bg-bg px-3 py-2 font-mono text-small " +
  "text-fg placeholder:text-fg/35 outline-none focus-visible:border-accent/60";

export type OptionSprintFiltre = {
  id: number;
  name: string;
  status: StatutSprint;
  enrolledCount?: number;
};

const ORDRE_STATUTS: StatutSprint[] = ["ACTIVE", "DRAFT", "INACTIVE", "COMPLETED"];

export function Filtres({
  action,
  statuts,
  statutActuel,
  sprints,
  sprintActuel,
  nomRecherche,
  valeurRecherche,
  placeholder,
}: {
  action: string;
  statuts: readonly { valeur: string; libelle: string }[];
  statutActuel?: string;
  sprints?: OptionSprintFiltre[];
  sprintActuel?: string;
  nomRecherche: string;
  valeurRecherche?: string;
  placeholder: string;
}) {
  const aUnFiltre = Boolean(statutActuel || sprintActuel || valeurRecherche);

  const groupes = ORDRE_STATUTS.map((st) => ({
    statut: st,
    libelle: LIBELLE_SPRINT[st],
    items: (sprints ?? []).filter((sp) => sp.status === st),
  })).filter((g) => g.items.length > 0);

  return (
    <form
      method="get"
      action={action}
      className="flex flex-wrap items-end gap-3 rounded-card border
                 border-fg/10 bg-surface/60 p-4"
    >
      {sprints && sprints.length > 0 ? (
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-small uppercase tracking-[0.15em] text-fg/45">
            Sprint
          </span>
          <select
            name="sprintId"
            defaultValue={sprintActuel ?? ""}
            className={`${champ} max-w-[18rem]`}
          >
            <option value="">Toutes les sessions</option>
            {groupes.map((g) => (
              <optgroup key={g.statut} label={g.libelle}>
                {g.items.map((sp) => (
                  <option key={sp.id} value={String(sp.id)}>
                    {sp.name}
                    {typeof sp.enrolledCount === "number"
                      ? ` (${sp.enrolledCount})`
                      : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-small uppercase tracking-[0.15em] text-fg/45">
          Statut
        </span>
        <select
          name="statut"
          defaultValue={statutActuel ?? ""}
          className={champ}
        >
          <option value="">Tous les statuts</option>
          {statuts.map((s) => (
            <option key={s.valeur} value={s.valeur}>
              {s.libelle}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-small uppercase tracking-[0.15em] text-fg/45">
          Recherche
        </span>
        <div className="relative flex items-center">
          <HugeiconsIcon
            icon={Search01Icon}
            size={15}
            className="pointer-events-none absolute left-3 text-fg/40"
          />
          <input
            type="search"
            name={nomRecherche}
            defaultValue={valeurRecherche ?? ""}
            placeholder={placeholder}
            autoCapitalize="none"
            spellCheck={false}
            className={`${champ} w-[clamp(12rem,36vw,19rem)] pl-9`}
          />
        </div>
      </label>

      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-field border
                   border-fg/25 bg-bg/70 px-4 py-2 font-mono text-small
                   text-fg/85 transition-colors outline-none
                   hover:border-accent/50 hover:text-fg focus-visible:border-fg"
      >
        <HugeiconsIcon icon={FilterHorizontalIcon} size={14} />
        <span>Filtrer</span>
      </button>

      {aUnFiltre ? (
        <Link
          href={action}
          className="inline-flex items-center gap-1.5 rounded-field border
                     border-fg/15 px-3 py-2 font-mono text-small text-fg/55
                     transition-colors hover:border-fg/30 hover:text-fg"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} />
          <span>Réinitialiser</span>
        </Link>
      ) : null}
    </form>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [enCours, demarrer] = useTransition();

  const [sprintId, setSprintId] = useState(sprintActuel ?? "");
  const [statut, setStatut] = useState(statutActuel ?? "");
  const [recherche, setRecherche] = useState(valeurRecherche ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSprintId(sprintActuel ?? "");
  }, [sprintActuel]);

  useEffect(() => {
    setStatut(statutActuel ?? "");
  }, [statutActuel]);

  useEffect(() => {
    setRecherche(valeurRecherche ?? "");
  }, [valeurRecherche]);

  const appliquer = useCallback(
    (next: { sprintId: string; statut: string; recherche: string }) => {
      const qs = new URLSearchParams();
      if (next.sprintId) qs.set("sprintId", next.sprintId);
      if (next.statut) qs.set("statut", next.statut);
      const qTrim = next.recherche.trim();
      if (qTrim) qs.set(nomRecherche, qTrim);
      const url = qs.toString() ? `${action}?${qs.toString()}` : action;
      demarrer(() => {
        router.push(url);
      });
    },
    [action, nomRecherche, router],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const aUnFiltre = Boolean(statut || sprintId || recherche.trim());

  const groupes = ORDRE_STATUTS.map((st) => ({
    statut: st,
    libelle: LIBELLE_SPRINT[st],
    items: (sprints ?? []).filter((sp) => sp.status === st),
  })).filter((g) => g.items.length > 0);

  return (
    <form
      method="get"
      action={action}
      onSubmit={(e) => {
        e.preventDefault();
        if (timerRef.current) clearTimeout(timerRef.current);
        appliquer({ sprintId, statut, recherche });
      }}
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
            value={sprintId}
            onChange={(e) => {
              const val = e.target.value;
              setSprintId(val);
              appliquer({ sprintId: val, statut, recherche });
            }}
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
          value={statut}
          onChange={(e) => {
            const val = e.target.value;
            setStatut(val);
            appliquer({ sprintId, statut: val, recherche });
          }}
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
          Recherche rapide
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
            value={recherche}
            onChange={(e) => {
              const val = e.target.value;
              setRecherche(val);
              if (timerRef.current) clearTimeout(timerRef.current);
              timerRef.current = setTimeout(() => {
                appliquer({ sprintId, statut, recherche: val });
              }, 250);
            }}
            placeholder={placeholder}
            autoCapitalize="none"
            spellCheck={false}
            className={`${champ} w-[clamp(13rem,36vw,21rem)] pl-9`}
          />
        </div>
      </label>

      <button
        type="submit"
        disabled={enCours}
        className="inline-flex items-center gap-2 rounded-field border
                   border-fg/25 bg-bg/70 px-4 py-2 font-mono text-small
                   text-fg/85 transition-colors outline-none
                   hover:border-accent/50 hover:text-fg focus-visible:border-fg disabled:opacity-50"
      >
        <HugeiconsIcon icon={FilterHorizontalIcon} size={14} />
        <span>{enCours ? "Filtrage…" : "Filtrer"}</span>
      </button>

      {aUnFiltre ? (
        <Link
          href={action}
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setSprintId("");
            setStatut("");
            setRecherche("");
          }}
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

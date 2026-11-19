"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Delete02Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import type { FormateurAdmin } from "@/lib/admin/types";
import { ModaleFormateurAdmin } from "./ModaleFormateurAdmin";

function deplace<T>(liste: T[], index: number, delta: -1 | 1): T[] {
  const cible = index + delta;
  if (cible < 0 || cible >= liste.length) return liste;
  const copie = [...liste];
  const [element] = copie.splice(index, 1);
  copie.splice(cible, 0, element);
  return copie;
}

export function SectionFormateursAdmin({
  trainers,
  setTrainers,
  onSauvegarder,
}: {
  trainers: FormateurAdmin[];
  setTrainers: Dispatch<SetStateAction<FormateurAdmin[]>>;
  onSauvegarder?: (suivants: FormateurAdmin[]) => void;
}) {
  const [indexEdition, setIndexEdition] = useState<number | "nouveau" | null>(
    null,
  );

  const formateurCourant =
    typeof indexEdition === "number" ? trainers[indexEdition] ?? null : null;

  return (
    <section className="flex flex-col gap-5 rounded-card border border-fg/15 bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-small font-bold uppercase tracking-[0.18em] text-accent">
            Formateurs ({trainers.length})
          </h2>
          <p className="mt-1 font-mono text-small text-fg/50">
            Pensez à cliquer sur « Enregistrer le contenu » après vos modifications.
          </p>
        </div>
        <button
          type="button"
          disabled={trainers.length >= 12}
          onClick={() => setIndexEdition("nouveau")}
          className="inline-flex items-center gap-1.5 rounded-field border border-accent/45
                     bg-accent/10 px-3.5 py-2 font-mono text-small font-semibold text-accent
                     transition-colors hover:border-accent hover:bg-accent/20 disabled:opacity-35"
        >
          <HugeiconsIcon icon={Add01Icon} size={14} />
          <span>Ajouter un formateur</span>
        </button>
      </div>

      {trainers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trainers.map((t, idx) => {
            const nomComplet = `${t.firstName} ${t.lastName ?? ""}`.trim();
            const initiales = nomComplet
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((m) => m[0]?.toUpperCase() ?? "")
              .join("");
            const liens = [
              t.githubUrl ? "GitHub" : null,
              t.linkedinUrl ? "LinkedIn" : null,
              t.portfolioUrl ? "Portfolio" : null,
            ].filter((x): x is string => x !== null);

            return (
              <article
                key={t.id ?? `formateur-${idx}`}
                className="flex flex-col justify-between gap-4 rounded-card border border-fg/15
                           bg-bg/55 p-5 transition-colors hover:border-fg/30"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="grid size-14 shrink-0 place-items-center overflow-hidden
                                 rounded-field border border-accent/30 bg-surface"
                    >
                      {t.photoPath ? (
                        <img
                          src={t.photoPath}
                          alt={nomComplet}
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <span className="font-mono text-body font-bold text-accent">
                          {initiales || "AI"}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-mono text-[0.72rem] uppercase tracking-[0.16em] text-accent">
                        {t.role || "Rôle à définir"}
                      </p>
                      <h3 className="truncate text-body font-bold text-fg">
                        {nomComplet || `Intervenant #${idx + 1}`}
                      </h3>
                    </div>
                  </div>

                  {t.bio?.trim() ? (
                    <p className="line-clamp-3 text-small text-fg/70">
                      {t.bio.trim()}
                    </p>
                  ) : (
                    <p className="font-mono text-small text-fg/35">
                      Aucune description renseignée.
                    </p>
                  )}

                  {liens.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {liens.map((l) => (
                        <span
                          key={l}
                          className="rounded-pill border border-fg/15 bg-surface px-2.5 py-0.5
                                     font-mono text-[0.72rem] text-fg/75"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-fg/10 pt-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      aria-label="Déplacer avant"
                      onClick={() => setTrainers((c) => deplace(c, idx, -1))}
                      className="rounded-field border border-fg/15 p-1.5 text-fg/65 hover:border-fg/35 hover:text-fg disabled:opacity-30"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === trainers.length - 1}
                      aria-label="Déplacer après"
                      onClick={() => setTrainers((c) => deplace(c, idx, 1))}
                      className="rounded-field border border-fg/15 p-1.5 text-fg/65 hover:border-fg/35 hover:text-fg disabled:opacity-30"
                    >
                      <HugeiconsIcon icon={ArrowRight01Icon} size={13} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIndexEdition(idx)}
                      className="inline-flex items-center gap-1.5 rounded-field border border-fg/20
                                 px-3 py-1.5 font-mono text-small text-fg/85 hover:border-accent/60 hover:text-accent"
                    >
                      <HugeiconsIcon icon={PencilEdit01Icon} size={13} />
                      <span>Modifier</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Supprimer le formateur"
                      onClick={() =>
                        setTrainers((c) => c.filter((_, i) => i !== idx))
                      }
                      className="rounded-field border border-fg/15 p-1.5 text-fg/55 hover:border-fg/35 hover:text-fg"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="font-mono text-small text-fg/45">
          Aucun formateur configuré pour l&apos;instant.
        </p>
      )}

      <ModaleFormateurAdmin
        ouvert={indexEdition !== null}
        creation={indexEdition === "nouveau"}
        initial={formateurCourant}
        onFermer={() => setIndexEdition(null)}
        onValider={(valeur) => {
          const suivants =
            indexEdition === "nouveau"
              ? [...trainers, valeur]
              : typeof indexEdition === "number"
                ? trainers.map((item, i) => (i === indexEdition ? valeur : item))
                : trainers;
          setTrainers(suivants);
          setIndexEdition(null);
          onSauvegarder?.(suivants);
        }}
      />
    </section>
  );
}

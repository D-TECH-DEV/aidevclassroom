"use client";

import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

export function ModaleConfirmation({
  ouvert,
  titre,
  message,
  libelleConfirmer = "Confirmer",
  enCours = false,
  erreur,
  onConfirmer,
  onFermer,
}: {
  ouvert: boolean;
  titre: string;
  message: string;
  libelleConfirmer?: string;
  enCours?: boolean;
  erreur?: string;
  onConfirmer: () => void;
  onFermer: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (ouvert && !dlg.open) {
      dlg.showModal();
    } else if (!ouvert && dlg.open) {
      dlg.close();
    }
  }, [ouvert]);

  if (!ouvert) return null;

  return (
    <dialog
      ref={ref}
      data-lenis-prevent
      onCancel={(e) => {
        e.preventDefault();
        if (!enCours) onFermer();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !enCours) onFermer();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-card border border-fg/20
                 bg-surface p-0 text-fg backdrop:bg-bg/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-h3 font-bold tracking-tight text-fg">{titre}</h2>
          <button
            type="button"
            disabled={enCours}
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-field border border-fg/15 p-1.5 text-fg/60
                       transition-colors hover:border-fg/35 hover:text-fg
                       disabled:opacity-40"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        <p className="text-small leading-relaxed text-fg/70">{message}</p>

        {erreur ? (
          <p
            role="alert"
            className="rounded-field border border-fg/25 bg-bg/70 px-3.5 py-2.5
                       font-mono text-small text-fg/85"
          >
            {erreur}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            disabled={enCours}
            onClick={onFermer}
            className="rounded-field border border-fg/20 px-4 py-2 font-mono
                       text-small text-fg/75 transition-colors hover:border-fg/40
                       hover:text-fg disabled:opacity-40"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={onConfirmer}
            className="rounded-field border border-fg/30 bg-fg/15 px-4 py-2
                       font-mono text-small font-semibold text-fg transition-colors
                       hover:bg-fg/25 disabled:opacity-40"
          >
            {enCours ? "Suppression…" : libelleConfirmer}
          </button>
        </div>
      </div>
    </dialog>
  );
}

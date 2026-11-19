"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import type { FormateurAdmin } from "@/lib/admin/types";
import {
  IconeGithub,
  IconeLinkedin,
  IconePortfolio,
} from "@/components/ui/IconesReseaux";

const champ =
  "w-full rounded-field border border-fg/20 bg-bg px-3.5 py-2.5 text-small " +
  "text-fg placeholder:text-fg/35 outline-none focus-visible:border-accent/60";
const etiquette = "font-mono text-small uppercase tracking-[0.15em] text-fg/55";

const VIDE: FormateurAdmin = {
  firstName: "", lastName: null, role: "",
  photoPath: null, badgePath: null, bio: null,
  githubUrl: null, linkedinUrl: null, portfolioUrl: null,
};

export function ModaleFormateurAdmin({
  ouvert,
  initial,
  creation,
  onFermer,
  onValider,
}: {
  ouvert: boolean;
  initial: FormateurAdmin | null;
  creation: boolean;
  onFermer: () => void;
  onValider: (valeur: FormateurAdmin) => void;
}) {
  const [formateur, setFormateur] = useState<FormateurAdmin>(initial ?? VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [uploadEnCours, setUploadEnCours] = useState(false);

  useEffect(() => {
    if (ouvert) {
      setFormateur(initial ?? VIDE);
      setErreur(null);
      setUploadEnCours(false);
    }
  }, [ouvert, initial]);

  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  function maj(patch: Partial<FormateurAdmin>) {
    setFormateur((c) => ({ ...c, ...patch }));
  }

  async function televerserPhoto(fichier: File | undefined) {
    if (!fichier) return;
    if (fichier.type !== "image/png") {
      setErreur("Veuillez sélectionner une image au format PNG uniquement.");
      return;
    }
    setErreur(null);
    setUploadEnCours(true);
    try {
      const fd = new FormData();
      fd.append("file", fichier);
      const res = await fetch("/admin/api/upload/formateur", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        photoPath?: string;
        data?: { photoPath?: string };
        message?: string;
      };
      const photoPath = data.photoPath ?? data.data?.photoPath;
      if (!res.ok || !photoPath) {
        setErreur(data.message ?? "Impossible d'envoyer la photo PNG.");
        return;
      }
      maj({ photoPath, badgePath: null });
    } catch {
      setErreur("Erreur réseau lors de l'envoi de la photo.");
    } finally {
      setUploadEnCours(false);
    }
  }

  function normaliseLien(url: string | null | undefined): string | null {
    const propre = url?.trim();
    if (!propre) return null;
    if (/^https?:\/\//i.test(propre)) {
      return propre.replace(/^http:\/\//i, "https://");
    }
    return `https://${propre.replace(/^\/+/, "")}`;
  }

  function valider() {
    if (!formateur.firstName.trim() || !formateur.role.trim()) {
      setErreur("Le prénom et le rôle sont obligatoires.");
      return;
    }
    onValider({
      ...formateur,
      githubUrl: normaliseLien(formateur.githubUrl),
      linkedinUrl: normaliseLien(formateur.linkedinUrl),
      portfolioUrl: normaliseLien(formateur.portfolioUrl),
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={creation ? "Ajouter un formateur" : "Modifier le formateur"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <div
        data-lenis-prevent
        className="flex max-h-[88svh] w-full max-w-2xl flex-col rounded-card border border-fg/20 bg-surface text-fg shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-fg/10 px-6 py-4">
          <div>
            <p className="font-mono text-small uppercase tracking-[0.2em] text-accent">
              {creation ? "Nouvel intervenant" : "Modification"}
            </p>
            <h3 className="mt-1 text-h3 font-bold text-fg">
              {creation
                ? "Ajouter un formateur"
                : `${formateur.firstName} ${formateur.lastName ?? ""}`.trim() ||
                  "Formateur"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-field border border-fg/15 p-1.5 text-fg/60 hover:border-fg/35 hover:text-fg"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["Prénom *", "firstName", 80, false],
                ["Nom (optionnel)", "lastName", 120, true],
                ["Rôle *", "role", 160, false],
              ] as const
            ).map(([label, key, maxLen, nullable]) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className={etiquette}>{label}</span>
                <input
                  type="text"
                  maxLength={maxLen}
                  value={formateur[key] ?? ""}
                  onChange={(e) =>
                    maj({
                      [key]: nullable ? e.target.value || null : e.target.value,
                    })
                  }
                  className={champ}
                />
              </label>
            ))}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={etiquette}>À propos de lui</span>
            <textarea
              rows={3}
              maxLength={1500}
              value={formateur.bio ?? ""}
              onChange={(e) => maj({ bio: e.target.value || null })}
              placeholder="Parcours, expertise et expérience terrain..."
              className={`${champ} resize-y`}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className={etiquette}>Photo PNG du formateur</span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-field border border-fg/15 bg-bg">
                {formateur.photoPath ? (
                  <img
                    src={formateur.photoPath}
                    alt="Aperçu"
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <span className="font-mono text-small text-fg/40">PNG</span>
                )}
              </div>
              <label
                className="cursor-pointer rounded-field border border-accent/45 bg-accent/10
                           px-3.5 py-2 font-mono text-small font-semibold text-accent
                           hover:border-accent hover:bg-accent/20"
              >
                <span>{uploadEnCours ? "Envoi…" : "Charger un PNG"}</span>
                <input
                  type="file"
                  accept="image/png"
                  disabled={uploadEnCours}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    void televerserPhoto(f);
                    e.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>
              {formateur.photoPath ? (
                <button
                  type="button"
                  onClick={() => maj({ photoPath: null })}
                  className="rounded-field border border-fg/15 px-3 py-2 font-mono text-small text-fg/60 hover:border-fg/35 hover:text-fg"
                >
                  Retirer
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className={etiquette}>Réseaux &amp; liens</span>
            {(
              [
                ["GitHub", "githubUrl", "https://github.com/...", IconeGithub],
                ["LinkedIn", "linkedinUrl", "https://www.linkedin.com/in/...", IconeLinkedin],
                ["Portfolio", "portfolioUrl", "https://...", IconePortfolio],
              ] as const
            ).map(([label, key, placeholder, Icone]) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="font-mono text-xs text-fg/65">{label}</span>
                <div className="flex items-center gap-2.5 rounded-field border border-fg/20 bg-bg px-3.5 py-2.5 focus-within:border-accent/60">
                  <Icone className="size-4 shrink-0 text-fg/55" />
                  <input
                    type="text"
                    inputMode="url"
                    maxLength={255}
                    value={formateur[key] ?? ""}
                    onChange={(e) => maj({ [key]: e.target.value || null })}
                    placeholder={placeholder}
                    className="w-full bg-transparent font-mono text-small text-fg placeholder:text-fg/35 outline-none"
                  />
                </div>
              </label>
            ))}
          </div>

          {erreur ? (
            <p className="rounded-field border border-fg/20 bg-bg px-3.5 py-2 font-mono text-small text-fg">
              {erreur}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-fg/10 bg-bg/40 px-6 py-4">
          <button
            type="button"
            onClick={onFermer}
            className="rounded-field border border-fg/20 px-4 py-2 font-mono text-small text-fg/70 hover:border-fg/40 hover:text-fg"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={valider}
            className="inline-flex items-center gap-1.5 rounded-field bg-accent px-5 py-2 font-bold text-small text-bg hover:opacity-90"
          >
            <HugeiconsIcon icon={Tick02Icon} size={15} />
            <span>{creation ? "Ajouter" : "Appliquer"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

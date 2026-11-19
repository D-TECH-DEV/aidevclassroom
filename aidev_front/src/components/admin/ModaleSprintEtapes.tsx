"use client";

import type { Sprint } from "@/lib/admin/types";

export const CHAMP_CLS =
  "w-full rounded-field border border-fg/20 bg-bg px-3.5 py-2.5 text-small " +
  "text-fg placeholder:text-fg/35 outline-none transition-colors " +
  "focus-visible:border-accent/60";

export const ETIQUETTE_CLS =
  "font-mono text-small uppercase tracking-[0.15em] text-fg/55";

export function slugifie(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 190);
}

export function EtapeIdentite({
  edition,
  nom,
  setNom,
  slug,
  setSlug,
  slugTouche,
  setSlugTouche,
  description,
  setDescription,
  debut,
  setDebut,
  fin,
  setFin,
  capacite,
  setCapacite,
}: {
  edition: boolean;
  nom: string;
  setNom: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  slugTouche: boolean;
  setSlugTouche: (v: boolean) => void;
  description: string;
  setDescription: (v: string) => void;
  debut: string;
  setDebut: (v: string) => void;
  fin: string;
  setFin: (v: string) => void;
  capacite: string;
  setCapacite: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETTE_CLS}>Nom du sprint</span>
          <input
            type="text"
            required
            maxLength={150}
            value={nom}
            placeholder="Sprint #2 — Yamoussoukro"
            onChange={(e) => {
              const v = e.target.value;
              setNom(v);
              if (!edition && !slugTouche) setSlug(slugifie(v));
            }}
            className={CHAMP_CLS}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETTE_CLS}>
            Slug {edition ? "(verrouillé)" : "(auto)"}
          </span>
          <input
            type="text"
            required={!edition}
            disabled={edition}
            maxLength={190}
            value={slug}
            onChange={(e) => {
              setSlugTouche(true);
              setSlug(e.target.value);
            }}
            placeholder="sprint-2-yamoussoukro"
            className={`${CHAMP_CLS} font-mono ${
              edition ? "opacity-55 cursor-not-allowed" : ""
            }`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={ETIQUETTE_CLS}>Description (optionnel)</span>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Une journée intensive pour livrer un vrai produit web avec l'IA."
          className={`${CHAMP_CLS} resize-y`}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETTE_CLS}>Date de début</span>
          <input
            type="datetime-local"
            required
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
            className={`${CHAMP_CLS} font-mono`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETTE_CLS}>Date de fin</span>
          <input
            type="datetime-local"
            required
            value={fin}
            onChange={(e) => setFin(e.target.value)}
            className={`${CHAMP_CLS} font-mono`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 sm:max-w-[16rem]">
        <span className={ETIQUETTE_CLS}>Capacité maximale (places)</span>
        <input
          type="number"
          min={1}
          step={1}
          value={capacite}
          onChange={(e) => setCapacite(e.target.value)}
          placeholder="Illimitée si vide"
          className={`${CHAMP_CLS} font-mono`}
        />
      </label>
    </div>
  );
}

export function EtapeTarifs({
  edition,
  sprint,
  prix,
  setPrix,
  minimum,
  setMinimum,
  prixDuo,
  setPrixDuo,
  minimumDuo,
  setMinimumDuo,
  retirerDuo,
  setRetirerDuo,
  ratioAcompte,
}: {
  edition: boolean;
  sprint?: Sprint | null;
  prix: string;
  setPrix: (v: string) => void;
  minimum: string;
  setMinimum: (v: string) => void;
  prixDuo: string;
  setPrixDuo: (v: string) => void;
  minimumDuo: string;
  setMinimumDuo: (v: string) => void;
  retirerDuo: boolean;
  setRetirerDuo: (v: boolean) => void;
  ratioAcompte: number | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-field border border-fg/15 bg-bg/50 p-4">
        <p className={`${ETIQUETTE_CLS} text-accent`}>Forfait Solo</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={ETIQUETTE_CLS}>Prix total (FCFA)</span>
            <input
              type="number"
              required
              min={1}
              step={1}
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              placeholder="20000"
              className={`${CHAMP_CLS} font-mono`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={ETIQUETTE_CLS}>Versement minimum (FCFA)</span>
            <input
              type="number"
              required
              min={1}
              step={1}
              value={minimum}
              onChange={(e) => setMinimum(e.target.value)}
              placeholder="5000"
              className={`${CHAMP_CLS} font-mono`}
            />
          </label>
        </div>
        {ratioAcompte !== null ? (
          <p className="mt-2.5 font-mono text-small text-fg/55">
            Acompte minimum calculé :{" "}
            <span className="text-accent">{ratioAcompte} %</span> du tarif Solo.
          </p>
        ) : null}
      </div>

      <div className="rounded-field border border-fg/15 bg-bg/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={ETIQUETTE_CLS}>Forfait Duo (optionnel · 2 places)</p>
          {edition && sprint?.duoPriceXof != null ? (
            <label className="flex items-center gap-2 font-mono text-small text-fg/70">
              <input
                type="checkbox"
                checked={retirerDuo}
                onChange={(e) => {
                  setRetirerDuo(e.target.checked);
                  if (e.target.checked) {
                    setPrixDuo("");
                    setMinimumDuo("");
                  }
                }}
                className="size-4 accent-[#2ee66b]"
              />
              <span>Désactiver le Duo</span>
            </label>
          ) : null}
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={ETIQUETTE_CLS}>Prix Duo (FCFA)</span>
            <input
              type="number"
              min={1}
              step={1}
              disabled={retirerDuo}
              value={prixDuo}
              onChange={(e) => {
                setRetirerDuo(false);
                setPrixDuo(e.target.value);
              }}
              placeholder="35000"
              className={`${CHAMP_CLS} font-mono disabled:opacity-45`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={ETIQUETTE_CLS}>Minimum Duo (FCFA)</span>
            <input
              type="number"
              min={1}
              step={1}
              disabled={retirerDuo}
              value={minimumDuo}
              onChange={(e) => {
                setRetirerDuo(false);
                setMinimumDuo(e.target.value);
              }}
              placeholder="10000"
              className={`${CHAMP_CLS} font-mono disabled:opacity-45`}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

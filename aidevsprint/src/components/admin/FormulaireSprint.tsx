"use client";

import { useActionState, useState } from "react";

import { creerNouveauSprint, type Etat } from "@/app/admin/actions";
import { Alerte } from "./Briques";

/**
 * Le formulaire de création d'un sprint.
 *
 * Les noms de champs suivent l'action serveur `creerNouveauSprint` :
 * `nom`, `slug`, `description`, `prix`, `minimum`, `debut`, `fin`,
 * `capacite`, `lancer`. Cocher « lancer » crée le sprint directement
 * en `ACTIVE`, sinon il naît en `DRAFT` et se lance depuis la liste.
 */

const INITIAL: Etat = {};

const champ =
  "w-full rounded-field border border-fg/20 bg-bg px-4 py-3 " +
  "text-fg placeholder:text-fg/35 outline-none " +
  "focus-visible:border-accent/60";

const etiquette =
  "font-mono text-small uppercase tracking-[0.15em] text-fg/55";

function slugifie(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 190);
}

export function FormulaireSprint() {
  const [etat, agir, enCours] = useActionState(creerNouveauSprint, INITIAL);
  const [slugTouche, setSlugTouche] = useState(false);
  const [slug, setSlug] = useState("");

  return (
    <form action={agir} className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={etiquette}>Nom</span>
          <input
            type="text"
            name="nom"
            required
            maxLength={150}
            placeholder="Sprint Dev Web Intensif"
            className={champ}
            onChange={(e) => {
              if (!slugTouche) setSlug(slugifie(e.target.value));
            }}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={etiquette}>Slug</span>
          <input
            type="text"
            name="slug"
            required
            maxLength={190}
            autoCapitalize="none"
            spellCheck={false}
            placeholder="sprint-dev-web-intensif"
            value={slug}
            onChange={(e) => {
              setSlugTouche(true);
              setSlug(slugifie(e.target.value));
            }}
            className={`${champ} font-mono`}
          />
          <span className="font-mono text-small text-fg/40">
            Minuscules, chiffres et tirets. Rempli seul depuis le nom.
          </span>
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className={etiquette}>Description</span>
        <textarea
          name="description"
          rows={3}
          placeholder="4 semaines pour construire une API complète."
          className={`${champ} resize-y`}
        />
      </label>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={etiquette}>Prix (FCFA)</span>
          <input
            type="number"
            name="prix"
            required
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="50000"
            className={`${champ} font-mono`}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={etiquette}>Versement minimum (FCFA)</span>
          <input
            type="number"
            name="minimum"
            required
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="5000"
            className={`${champ} font-mono`}
          />
          <span className="font-mono text-small text-fg/40">
            Ne peut pas dépasser le prix.
          </span>
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={etiquette}>Début</span>
          <input type="datetime-local" name="debut" required className={champ} />
        </label>

        <label className="flex flex-col gap-2">
          <span className={etiquette}>Fin</span>
          <input type="datetime-local" name="fin" required className={champ} />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={etiquette}>Capacité (optionnel)</span>
          <input
            type="number"
            name="capacite"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="50"
            className={`${champ} font-mono`}
          />
        </label>

        <label className="flex flex-row items-center gap-3 rounded-field border border-fg/15 bg-surface px-4 py-3">
          <input
            type="checkbox"
            name="lancer"
            value="oui"
            className="size-5 accent-[#2ee66b]"
          />
          <span className="flex flex-col">
            <span className={etiquette}>Lancer immédiatement</span>
            <span className="font-mono text-small text-fg/45">
              Coché = créé en « Lancé », décoché = brouillon.
            </span>
          </span>
        </label>
      </div>

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}

      <button
        type="submit"
        disabled={enCours}
        className="mt-1 w-fit rounded-field bg-cta px-6 py-3 font-bold
                   text-fg outline-none focus-visible:border focus-visible:border-fg
                   disabled:opacity-60"
      >
        {enCours ? "Création…" : "Créer le sprint"}
      </button>
    </form>
  );
}

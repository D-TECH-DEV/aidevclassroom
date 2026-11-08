"use client";

import { useActionState, useState } from "react";

import {
  creerNouveauSprint,
  modifierSprintExistant,
  type Etat,
} from "@/app/admin/actions";
import type { Sprint } from "@/lib/admin/types";
import { Alerte } from "./Briques";

/**
 * Le formulaire de création d'un sprint.
 *
 * Les noms de champs suivent l'action serveur `creerNouveauSprint` :
 * `nom`, `slug`, `description`, `prix`, `minimum`, `prixDuo`,
 * `minimumDuo`, `debut`, `fin`, `capacite`, `lancer`. Cocher « lancer »
 * crée le sprint directement en `ACTIVE`, sinon il naît en `DRAFT` et se
 * lance depuis la liste. Le duo vide = pas de forfait duo.
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
          <span className={etiquette}>Prix duo — 2 places (FCFA, optionnel)</span>
          <input
            type="number"
            name="prixDuo"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="80000"
            className={`${champ} font-mono`}
          />
          <span className="font-mono text-small text-fg/40">
            Vide = pas de forfait duo.
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className={etiquette}>Minimum duo (FCFA, optionnel)</span>
          <input
            type="number"
            name="minimumDuo"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="10000"
            className={`${champ} font-mono`}
          />
          <span className="font-mono text-small text-fg/40">
            Ne peut pas dépasser le prix duo.
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

function versSaisieDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Le formulaire de modification d'un sprint.
 *
 * Mêmes champs que la création, pré-remplis, sans `slug` (immuable) ni
 * `lancer` (le statut se change depuis la liste). Vider les deux champs
 * duo ne touche à rien ; cocher « retirer » supprime le forfait duo.
 */
export function FormulaireSprintEdition({ sprint }: { sprint: Sprint }) {
  const [etat, agir, enCours] = useActionState(modifierSprintExistant, INITIAL);

  return (
    <form action={agir} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={sprint.id} />

      <label className="flex flex-col gap-2">
        <span className={etiquette}>Nom</span>
        <input
          type="text"
          name="nom"
          required
          maxLength={150}
          defaultValue={sprint.name}
          className={champ}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={etiquette}>Description</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={sprint.description ?? ""}
          className={`${champ} resize-y`}
        />
      </label>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={etiquette}>Prix (FCFA)</span>
          <input
            type="number"
            name="prix"
            min={1}
            step={1}
            inputMode="numeric"
            defaultValue={sprint.priceXof}
            className={`${champ} font-mono`}
          />
          <span className="font-mono text-small text-fg/40">
            Laisser tel quel pour ne pas toucher. Les dossiers existants
            gardent leur total figé.
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className={etiquette}>Versement minimum (FCFA)</span>
          <input
            type="number"
            name="minimum"
            min={1}
            step={1}
            inputMode="numeric"
            defaultValue={sprint.minimumPaymentXof}
            className={`${champ} font-mono`}
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={etiquette}>Prix duo — 2 places (FCFA)</span>
          <input
            type="number"
            name="prixDuo"
            min={1}
            step={1}
            inputMode="numeric"
            defaultValue={sprint.duoPriceXof ?? ""}
            className={`${champ} font-mono`}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={etiquette}>Minimum duo (FCFA)</span>
          <input
            type="number"
            name="minimumDuo"
            min={1}
            step={1}
            inputMode="numeric"
            defaultValue={sprint.duoMinimumPaymentXof ?? ""}
            className={`${champ} font-mono`}
          />
        </label>
      </div>

      <label className="flex flex-row items-center gap-3 rounded-field border border-fg/15 bg-surface px-4 py-3">
        <input
          type="checkbox"
          name="retirerDuo"
          value="oui"
          className="size-5 accent-[#2ee66b]"
        />
        <span className="flex flex-col">
          <span className={etiquette}>Retirer le forfait duo</span>
          <span className="font-mono text-small text-fg/45">
            Les dossiers duo existants gardent leur total figé.
          </span>
        </span>
      </label>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={etiquette}>Début</span>
          <input
            type="datetime-local"
            name="debut"
            defaultValue={versSaisieDate(sprint.startAt)}
            className={champ}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={etiquette}>Fin</span>
          <input
            type="datetime-local"
            name="fin"
            defaultValue={versSaisieDate(sprint.endAt)}
            className={champ}
          />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className={etiquette}>Capacité (places, optionnel)</span>
        <input
          type="number"
          name="capacite"
          min={1}
          step={1}
          inputMode="numeric"
          defaultValue={sprint.capacity ?? ""}
          className={`${champ} font-mono`}
        />
        <span className="font-mono text-small text-fg/40">
          Un dossier duo compte 2 places.
        </span>
      </label>

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}

      <button
        type="submit"
        disabled={enCours}
        className="mt-1 w-fit rounded-field bg-cta px-6 py-3 font-bold
                   text-fg outline-none focus-visible:border focus-visible:border-fg
                   disabled:opacity-60"
      >
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

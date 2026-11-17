"use client";

import { useActionState } from "react";

import { modifierSprintExistant, type Etat } from "@/app/admin/actions";
import type { Sprint } from "@/lib/admin/types";
import { Alerte } from "./Briques";

const INITIAL: Etat = {};

const champ =
  "w-full rounded-field border border-fg/20 bg-bg px-4 py-3 " +
  "text-fg placeholder:text-fg/35 outline-none " +
  "focus-visible:border-accent/60";

const etiquette =
  "font-mono text-small uppercase tracking-[0.15em] text-fg/55";

export function ChampsOrganisation({ sprint }: { sprint?: Sprint }) {
  return (
    <div className="flex flex-col gap-5 rounded-field border border-fg/15 bg-surface/60 p-4">
      <p className={etiquette}>Organisation &amp; Programme</p>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={etiquette}>Ville</span>
          <input
            type="text"
            name="ville"
            maxLength={100}
            defaultValue={sprint?.city ?? ""}
            placeholder="Yamoussoukro"
            className={champ}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={etiquette}>Format</span>
          <input
            type="text"
            name="format"
            maxLength={120}
            defaultValue={sprint?.format ?? ""}
            placeholder="1 journée · présentiel"
            className={champ}
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={etiquette}>Lieu / Salle</span>
          <input
            type="text"
            name="lieu"
            maxLength={255}
            defaultValue={sprint?.location ?? ""}
            placeholder="Mairie de Yamoussoukro — salle multimédia Orange"
            className={champ}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={etiquette}>Niveau prérequis</span>
          <input
            type="text"
            name="niveau"
            maxLength={120}
            defaultValue={sprint?.level ?? ""}
            placeholder="Bases en dev"
            className={champ}
          />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className={etiquette}>
          Étapes du programme (une par ligne, 8 maximum)
        </span>
        <textarea
          name="modules"
          rows={4}
          defaultValue={(sprint?.modules ?? []).join("\n")}
          placeholder={
            "Le design de ton site\nLe code, en guidant l'IA\nTon admin + ton chatbot IA\nTon site déployé en ligne"
          }
          className={`${champ} resize-y`}
        />
      </label>
    </div>
  );
}

function versSaisieDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

      <ChampsOrganisation sprint={sprint} />

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

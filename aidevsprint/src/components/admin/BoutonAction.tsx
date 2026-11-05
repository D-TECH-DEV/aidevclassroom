"use client";

import { useActionState } from "react";

import {
  changerStatutSprint,
  changeStatutInscription,
  reverifiePaiement,
  type Etat,
} from "@/app/admin/actions";
import {
  LIBELLE_INSCRIPTION,
  LIBELLE_SPRINT,
  type StatutInscription,
  type StatutSprint,
} from "@/lib/admin/types";

/**
 * Les deux boutons qui écrivent quelque chose.
 *
 * Chacun est un vrai formulaire avec son propre `useActionState` : deux
 * boutons sur la même page ne partagent donc ni leur état d'attente ni
 * leur message d'erreur. Un `recheck` qui échoue sur la ligne 3 n'affiche
 * rien sur la ligne 4.
 */

const INITIAL: Etat = {};

const bouton =
  "rounded-field border px-3 py-1.5 font-mono text-small outline-none " +
  "focus-visible:border-fg disabled:opacity-50";

/**
 * Fait passer une inscription à l'état demandé.
 *
 * `TRANSITIONS` filtre déjà les cibles impossibles côté appelant — mais
 * `COMPLETED` dépend en plus du solde, que seule l'API sait trancher. Si
 * elle refuse, son message s'affiche ici.
 */
export function BoutonStatut({
  id,
  vers,
}: {
  id: number;
  vers: StatutInscription;
}) {
  const [etat, agir, enCours] = useActionState(
    changeStatutInscription,
    INITIAL,
  );

  return (
    <form action={agir} className="flex flex-col items-start gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="statut" value={vers} />
      <button
        type="submit"
        disabled={enCours}
        className={`${bouton} ${
          vers === "CANCELLED"
            ? "border-fg/20 text-fg/60"
            : "border-accent/50 text-accent"
        }`}
      >
        {enCours ? "…" : `Passer à « ${LIBELLE_INSCRIPTION[vers]} »`}
      </button>
      {etat.erreur ? (
        <span role="alert" className="font-mono text-small text-fg/70">
          {etat.erreur}
        </span>
      ) : null}
    </form>
  );
}

/**
 * Fait passer un sprint à l'état demandé (« Lancer », « Désactiver »…).
 *
 * Même principe que `BoutonStatut` : un formulaire par bouton, pour que
 * l'attente et l'erreur restent locales à la ligne.
 */
export function BoutonSprint({
  id,
  vers,
  miseEnAvant,
}: {
  id: number;
  vers: StatutSprint;
  miseEnAvant?: boolean;
}) {
  const [etat, agir, enCours] = useActionState(changerStatutSprint, INITIAL);

  return (
    <form action={agir} className="flex flex-col items-start gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="statut" value={vers} />
      <button
        type="submit"
        disabled={enCours}
        className={`${bouton} ${
          miseEnAvant ?? vers === "ACTIVE"
            ? "border-accent/50 text-accent"
            : "border-fg/20 text-fg/60"
        }`}
      >
        {enCours ? "…" : LIBELLE_SPRINT[vers] === "Lancé" && vers === "ACTIVE"
          ? "Lancer"
          : `Passer à « ${LIBELLE_SPRINT[vers]} »`}
      </button>
      {etat.erreur ? (
        <span role="alert" className="font-mono text-small text-fg/70">
          {etat.erreur}
        </span>
      ) : null}
    </form>
  );
}

/**
 * Redemande son avis à Paystack.
 *
 * Sert quand un webhook s'est perdu : le paiement est réglé chez Paystack
 * mais reste `PENDING` chez nous. C'est la seule façon de rattraper sans
 * toucher à la base.
 */
export function BoutonReverifier({ id }: { id: number }) {
  const [etat, agir, enCours] = useActionState(reverifiePaiement, INITIAL);

  return (
    <form action={agir} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={enCours}
        className={`${bouton} border-fg/20 text-fg/70`}
      >
        {enCours ? "Vérification…" : "Revérifier"}
      </button>
      {etat.erreur ? (
        <span role="alert" className="font-mono text-small text-fg/70">
          {etat.erreur}
        </span>
      ) : null}
    </form>
  );
}

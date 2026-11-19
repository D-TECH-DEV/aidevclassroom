"use client";

import { useActionState, useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, RefreshIcon } from "@hugeicons/core-free-icons";

import {
  changerStatutSprint,
  changeStatutInscription,
  reverifiePaiement,
  supprimerSprintExistant,
  type Etat,
} from "@/app/admin/actions";
import {
  LIBELLE_INSCRIPTION,
  LIBELLE_SPRINT,
  type StatutInscription,
  type StatutSprint,
} from "@/lib/admin/types";
import { ModaleConfirmation } from "./ModaleConfirmation";
import { emettreToastNotificationMail } from "./ToastNotificationMail";

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

const STATUTS_SPRINT: readonly StatutSprint[] = [
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "COMPLETED",
];

/**
 * Affiche les 4 boutons de statut pour un sprint.
 * Le statut actuel est mis en évidence ; les autres déclenchent la transition.
 */
export function GroupeStatutsSprint({
  id,
  statutActuel,
}: {
  id: number;
  statutActuel: StatutSprint;
}) {
  const [enCours, demarrer] = useTransition();
  const [cibleEnCours, setCibleEnCours] = useState<StatutSprint | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cibleConfirm, setCibleConfirm] = useState<
    "DRAFT" | "INACTIVE" | "ACTIVE" | null
  >(null);
  const [notifier, setNotifier] = useState(true);
  const [noteNotification, setNoteNotification] = useState("");

  function executerChangement(
    vers: StatutSprint,
    opts?: { notifier: boolean; note: string },
  ) {
    setErreur(null);
    setCibleEnCours(vers);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("id", String(id));
      fd.set("statut", vers);
      if (opts) {
        fd.set("notifier", opts.notifier ? "oui" : "non");
        if (opts.note.trim()) fd.set("noteNotification", opts.note.trim());
      }
      const res = await changerStatutSprint(INITIAL, fd);
      if (res.erreur) setErreur(res.erreur);
      else emettreToastNotificationMail(res.notification);
      setCibleEnCours(null);
      setCibleConfirm(null);
    });
  }

  function basculer(vers: StatutSprint) {
    if (vers === statutActuel || enCours) return;
    const versSuspension =
      statutActuel === "ACTIVE" && (vers === "DRAFT" || vers === "INACTIVE");
    const versActivation =
      (statutActuel === "DRAFT" || statutActuel === "INACTIVE") &&
      vers === "ACTIVE";
    if (versSuspension || versActivation) {
      setNotifier(true);
      setNoteNotification("");
      setCibleConfirm(vers);
      return;
    }
    executerChangement(vers);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {STATUTS_SPRINT.map((s) => {
          const actif = s === statutActuel;
          const chargement = enCours && cibleEnCours === s;
          return (
            <button
              key={s}
              type="button"
              disabled={actif || enCours}
              onClick={() => basculer(s)}
              className={`rounded-field border px-2.5 py-1 font-mono text-[0.75rem]
                          transition-colors outline-none focus-visible:border-fg ${
                            actif
                              ? s === "ACTIVE"
                                ? "border-accent/60 bg-accent/15 font-semibold text-accent"
                                : "border-fg/35 bg-fg/12 font-semibold text-fg"
                              : s === "ACTIVE"
                                ? "border-accent/35 text-accent/85 hover:border-accent hover:bg-accent/10 disabled:opacity-50"
                                : "border-fg/20 text-fg/60 hover:border-fg/40 hover:text-fg disabled:opacity-50"
                          }`}
            >
              {chargement ? "…" : LIBELLE_SPRINT[s]}
            </button>
          );
        })}
      </div>
      {erreur ? (
        <span role="alert" className="font-mono text-small text-fg/75">
          {erreur}
        </span>
      ) : null}

      {cibleConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
          onClick={() => !enCours && setCibleConfirm(null)}
        >
          <div
            className="flex w-[min(94vw,30rem)] flex-col gap-4 rounded-card border border-fg/20 bg-surface p-5 text-fg"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="font-mono text-small uppercase tracking-[0.18em] text-accent">
                Changement de statut
              </p>
              <h3 className="mt-1 text-h3 font-bold text-fg">
                Passer en « {LIBELLE_SPRINT[cibleConfirm]} »
              </h3>
              <p className="mt-1 text-small text-fg/70">
                {cibleConfirm === "ACTIVE"
                  ? "La session sera ouverte sur le site public."
                  : "La session ne sera plus ouverte aux inscriptions."}
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-field border border-accent/30 bg-bg/60 px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={notifier}
                onChange={(e) => setNotifier(e.target.checked)}
                className="mt-0.5 size-4 accent-[#2ee66b]"
              />
              <span className="text-small text-fg/85">
                Notifier par e-mail les inscrits ayant déjà versé un acompte
              </span>
            </label>

            {notifier ? (
              <label className="flex flex-col gap-1">
                <span className="font-mono text-small text-fg/65">
                  Motif ou message complémentaire (optionnel)
                </span>
                <input
                  type="text"
                  maxLength={500}
                  value={noteNotification}
                  onChange={(e) => setNoteNotification(e.target.value)}
                  placeholder="Ex. Session reportée à une date ultérieure."
                  className="rounded-field border border-fg/20 bg-bg px-3 py-2 text-small text-fg outline-none focus:border-accent"
                />
              </label>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={enCours}
                onClick={() => setCibleConfirm(null)}
                className="rounded-field border border-fg/20 px-4 py-1.5 font-mono text-small text-fg/75 hover:border-fg/40 hover:text-fg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={() =>
                  executerChangement(cibleConfirm, {
                    notifier,
                    note: noteNotification,
                  })
                }
                className="rounded-field bg-accent px-4 py-1.5 font-bold text-small text-bg hover:opacity-90 disabled:opacity-50"
              >
                {enCours ? "Traitement…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Supprime un sprint via une modale de confirmation dédiée (sans inscriptions).
 */
export function BoutonSupprimerSprint({
  id,
  nom,
}: {
  id: number;
  nom?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | undefined>(undefined);

  function confirmer() {
    setErreur(undefined);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("id", String(id));
      const res = await supprimerSprintExistant(INITIAL, fd);
      if (res.erreur) {
        setErreur(res.erreur);
        return;
      }
      setOuvert(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErreur(undefined);
          setOuvert(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-field border
                   border-fg/20 px-2.5 py-1.5 font-mono text-small text-fg/65
                   transition-colors hover:border-fg/40 hover:text-fg"
      >
        <HugeiconsIcon icon={Delete02Icon} size={14} />
        <span>Supprimer</span>
      </button>

      <ModaleConfirmation
        ouvert={ouvert}
        titre="Supprimer le sprint"
        message={`Confirmez-vous la suppression définitive de « ${nom ?? `Sprint #${id}`} » ? Cette action est irréversible (impossible si des inscriptions existent).`}
        libelleConfirmer="Supprimer définitivement"
        enCours={enCours}
        erreur={erreur}
        onConfirmer={confirmer}
        onFermer={() => setOuvert(false)}
      />
    </>
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
        className={`${bouton} inline-flex items-center gap-1.5 border-fg/20
                    text-fg/75 transition-colors hover:border-fg/40 hover:text-fg`}
      >
        <HugeiconsIcon icon={RefreshIcon} size={13} />
        <span>{enCours ? "Vérification…" : "Revérifier"}</span>
      </button>
      {etat.erreur ? (
        <span role="alert" className="font-mono text-small text-fg/70">
          {etat.erreur}
        </span>
      ) : null}
    </form>
  );
}

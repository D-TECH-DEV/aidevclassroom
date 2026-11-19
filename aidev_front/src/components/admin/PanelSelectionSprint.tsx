"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  Mail01Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import { validerSelectionSprint, type Etat } from "@/app/admin/actions";
import type { SprintSelectionPayload } from "@/lib/admin/api";
import { montant } from "@/lib/admin/types";
import {
  Alerte,
  Cadre,
  Cellule,
  Ligne,
  Pagination,
  Tableau,
  Tuile,
  Vide,
} from "./Briques";
import { emettreToastNotificationMail } from "./ToastNotificationMail";

const INITIAL: Etat = {};

export function PanelSelectionSprint({
  sprintId,
  selection,
  rechercheActuelle,
}: {
  sprintId: number;
  selection: SprintSelectionPayload;
  rechercheActuelle?: string;
}) {
  const router = useRouter();
  const [navEnCours, demarrerNav] = useTransition();
  const [recherche, setRecherche] = useState(rechercheActuelle ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [notifier, setNotifier] = useState(true);
  const [note, setNote] = useState("");

  const [etat, agir, enCours] = useActionState(validerSelectionSprint, INITIAL);

  useEffect(() => {
    setRecherche(rechercheActuelle ?? "");
  }, [rechercheActuelle]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (etat.succes && modaleOuverte) {
      emettreToastNotificationMail(etat.notification);
      setModaleOuverte(false);
      router.refresh();
    }
  }, [etat.succes, etat.notification, modaleOuverte, router]);

  const naviguer = useCallback(
    (next: {
      group: "selected" | "waitlist" | "unpaid";
      search: string;
    }) => {
      const qs = new URLSearchParams({
        onglet: "selection",
        group: next.group,
      });
      const qTrim = next.search.trim();
      if (qTrim) qs.set("search", qTrim);
      demarrerNav(() => {
        router.push(`/admin/sprints/${sprintId}?${qs.toString()}`);
      });
    },
    [router, sprintId],
  );

  const capaciteLabel =
    selection.capacity !== null
      ? `${selection.seatsUsed} / ${selection.capacity}`
      : `${selection.seatsUsed} / ∞`;

  const groupe = selection.group;
  const lignes = selection.items;

  const peutNotifier =
    selection.selectedCount > 0 || selection.waitlistCount > 0;

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tuile
          libelle="Places allouées"
          valeur={capaciteLabel}
          precision={
            selection.seatsRemaining !== null
              ? `${selection.seatsRemaining} place(s) libre(s)`
              : "Capacité illimitée"
          }
          accent
        />
        <Tuile
          libelle="Adhérents retenus"
          valeur={String(selection.selectedCount)}
          precision="Classés par % payé décroissant"
        />
        <Tuile
          libelle="Liste d'attente"
          valeur={String(selection.waitlistCount)}
          precision="Quota atteint ou DUO hors capacité"
        />
        <Tuile
          libelle="2/3 remboursables"
          valeur={montant(selection.totalRefundableTwoThirdsXof)}
          precision="Total sur la liste d'attente"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-fg/10 bg-surface/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={navEnCours}
            onClick={() => naviguer({ group: "selected", search: recherche })}
            className={`inline-flex items-center gap-1.5 rounded-field border px-3.5 py-2 font-mono text-small transition-colors ${
              groupe === "selected"
                ? "border-accent/60 bg-accent/15 font-semibold text-accent"
                : "border-fg/20 bg-bg/60 text-fg/75 hover:border-fg/40 hover:text-fg"
            }`}
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} />
            <span>Retenus ({selection.selectedCount})</span>
          </button>

          <button
            type="button"
            disabled={navEnCours}
            onClick={() => naviguer({ group: "waitlist", search: recherche })}
            className={`inline-flex items-center gap-1.5 rounded-field border px-3.5 py-2 font-mono text-small transition-colors ${
              groupe === "waitlist"
                ? "border-accent/60 bg-accent/15 font-semibold text-accent"
                : "border-fg/20 bg-bg/60 text-fg/75 hover:border-fg/40 hover:text-fg"
            }`}
          >
            <HugeiconsIcon icon={Clock01Icon} size={15} />
            <span>Liste d&apos;attente ({selection.waitlistCount})</span>
          </button>

          <button
            type="button"
            disabled={navEnCours}
            onClick={() => naviguer({ group: "unpaid", search: recherche })}
            className={`rounded-field border px-3.5 py-2 font-mono text-small transition-colors ${
              groupe === "unpaid"
                ? "border-accent/60 bg-accent/15 font-semibold text-accent"
                : "border-fg/20 bg-bg/60 text-fg/75 hover:border-fg/40 hover:text-fg"
            }`}
          >
            Non payés à 0 FCFA ({selection.unpaidCount})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center">
            <HugeiconsIcon
              icon={Search01Icon}
              size={14}
              className="pointer-events-none absolute left-3 text-fg/40"
            />
            <input
              type="search"
              value={recherche}
              onChange={(e) => {
                const val = e.target.value;
                setRecherche(val);
                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => {
                  naviguer({ group: groupe, search: val });
                }, 250);
              }}
              placeholder="Recherche rapide…"
              className="w-[14rem] rounded-field border border-fg/20 bg-bg py-2 pr-3 pl-8 font-mono text-small text-fg placeholder:text-fg/35 outline-none focus-visible:border-accent/60"
            />
          </div>

          <button
            type="button"
            disabled={!peutNotifier}
            onClick={() => {
              setNotifier(true);
              setNote("");
              setModaleOuverte(true);
            }}
            className="inline-flex items-center gap-2 rounded-field bg-accent px-4 py-2 font-bold text-small text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <HugeiconsIcon icon={Mail01Icon} size={16} />
            <span>Valider la sélection et notifier</span>
          </button>
        </div>
      </div>

      <div className="mt-6">
        <Cadre
          titre={
            groupe === "selected"
              ? `Adhérents retenus (${selection.total})`
              : groupe === "waitlist"
                ? `Liste d'attente — Non retenus (${selection.total})`
                : `Inscriptions sans versement (${selection.total})`
          }
          action={
            <span className="font-mono text-small text-fg/50">
              {navEnCours
                ? "Chargement…"
                : "Priorité : % payé décroissant, puis ancienneté du 1er paiement"}
            </span>
          }
        >
          {lignes.length ? (
            <>
              <Tableau
                entetes={[
                  "Rang",
                  "Participant",
                  "Forfait",
                  "Progression paiement",
                  groupe === "waitlist" ? "2/3 remboursable" : "Reste à payer",
                ]}
              >
                {lignes.map((item) => (
                  <Ligne key={item.enrollmentId}>
                    <Cellule mono>#{item.rank}</Cellule>
                    <Cellule>
                      <p className="font-semibold text-fg">{item.studentName}</p>
                      <p className="font-mono text-xs text-fg/55">
                        {item.email} · {item.phone}
                      </p>
                    </Cellule>
                    <Cellule mono>
                      {item.plan === "DUO" ? "Duo (2 places)" : "Solo (1 place)"}
                    </Cellule>
                    <Cellule>
                      <div className="flex min-w-[160px] flex-col gap-1">
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="font-bold text-accent">
                            {item.paidPercent} %
                          </span>
                          <span className="text-fg/65">
                            {montant(item.paidXof)} /{" "}
                            {montant(item.totalAmountXof)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-fg/10">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${item.paidPercent}%` }}
                          />
                        </div>
                      </div>
                    </Cellule>
                    <Cellule mono>
                      {groupe === "waitlist" ? (
                        <span className="rounded-pill border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                          {montant(item.refundableTwoThirdsXof)}
                        </span>
                      ) : (
                        <span>
                          {item.remainingXof > 0
                            ? montant(item.remainingXof)
                            : "Soldé"}
                        </span>
                      )}
                    </Cellule>
                  </Ligne>
                ))}
              </Tableau>

              <Pagination
                base={`/admin/sprints/${sprintId}`}
                page={selection.page}
                limit={selection.limit}
                total={selection.total}
                parametres={{
                  onglet: "selection",
                  group: groupe,
                  search: rechercheActuelle,
                }}
              />
            </>
          ) : (
            <Vide>Aucun dossier dans cette catégorie pour ce sprint.</Vide>
          )}
        </Cadre>
      </div>

      {modaleOuverte ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
          onClick={() => !enCours && setModaleOuverte(false)}
        >
          <form
            action={agir}
            onClick={(e) => e.stopPropagation()}
            className="flex w-[min(94vw,32rem)] flex-col gap-4 rounded-card border border-fg/20 bg-surface p-6 text-fg"
          >
            <input type="hidden" name="id" value={sprintId} />
            <input
              type="hidden"
              name="notifier"
              value={notifier ? "oui" : "non"}
            />

            <div>
              <p className="font-mono text-small uppercase tracking-[0.18em] text-accent">
                Confirmation de sélection
              </p>
              <h3 className="mt-1 text-h3 font-bold text-fg">
                Notifier les résultats de sélection
              </h3>
              <p className="mt-1.5 text-small text-fg/75">
                <strong>{selection.selectedCount}</strong> retenu(s) (
                {selection.seatsUsed} place(s)) et{" "}
                <strong>{selection.waitlistCount}</strong> en liste d&apos;attente
                ({montant(selection.totalRefundableTwoThirdsXof)} remboursables
                aux 2/3).
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
                Envoyer les e-mails personnalisés (confirmation aux retenus et
                avis 2/3 remboursables aux non-retenus)
              </span>
            </label>

            {notifier ? (
              <label className="flex flex-col gap-1">
                <span className="font-mono text-small text-fg/65">
                  Message complémentaire (optionnel)
                </span>
                <input
                  type="text"
                  name="noteNotification"
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex. Rendez-vous à 09h00 précises."
                  className="rounded-field border border-fg/20 bg-bg px-3 py-2 text-small text-fg outline-none focus:border-accent"
                />
              </label>
            ) : null}

            {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={enCours}
                onClick={() => setModaleOuverte(false)}
                className="rounded-field border border-fg/20 px-4 py-2 font-mono text-small text-fg/75 hover:border-fg/40 hover:text-fg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={enCours}
                className="inline-flex items-center gap-1.5 rounded-field bg-accent px-4 py-2 font-bold text-small text-bg hover:opacity-90 disabled:opacity-50"
              >
                <HugeiconsIcon icon={Tick02Icon} size={15} />
                <span>{enCours ? "Envoi…" : "Confirmer et notifier"}</span>
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

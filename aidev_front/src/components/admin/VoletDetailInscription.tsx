"use client";

import { useEffect } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import {
  date,
  montant,
  nomEtudiant,
  TRANSITIONS,
  type Inscription,
  type Paiement,
} from "@/lib/admin/types";
import { PastilleInscription, PastillePaiement } from "./Briques";
import { BoutonReverifier, BoutonStatut } from "./BoutonAction";

export function VoletDetailInscription({
  inscription,
  onFermer,
}: {
  inscription: Inscription | null;
  onFermer: () => void;
}) {
  useEffect(() => {
    if (!inscription) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inscription, onFermer]);

  if (!inscription) return null;

  const paye = inscription.totalPaidXof ?? 0;
  const reste = inscription.remainingAmountXof ?? 0;
  const pct =
    inscription.totalAmountXof > 0
      ? Math.min(100, Math.round((paye / inscription.totalAmountXof) * 100))
      : 0;
  const solde = reste === 0;
  const cibles = TRANSITIONS[inscription.status].filter(
    (c) => c !== "COMPLETED" || solde,
  );
  const paiements: Paiement[] = inscription.payments ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Détails de l'inscription #${inscription.id}`}
      className="fixed inset-0 z-50 flex justify-end bg-bg/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <aside
        data-lenis-prevent
        className="flex h-full w-full max-w-lg flex-col border-l border-fg/15
                   bg-surface text-fg shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-fg/10 px-6 py-5">
          <div>
            <p className="font-mono text-small uppercase tracking-[0.18em] text-fg/45">
              Dossier d&apos;inscription · #{inscription.id}
            </p>
            <h2 className="mt-1 text-h3 font-bold tracking-tight text-fg">
              {nomEtudiant(inscription.student)}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              <PastilleInscription statut={inscription.status} />
              <span className="font-mono text-small text-fg/50">
                {date(inscription.createdAt)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer le volet"
            className="rounded-field border border-fg/15 p-1.5 text-fg/60
                       transition-colors hover:border-fg/35 hover:text-fg"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <section className="rounded-field border border-fg/15 bg-bg/50 p-4">
            <p className="font-mono text-small uppercase tracking-[0.16em] text-fg/50">
              Synthèse financière
            </p>
            <div className="mt-3">
              <div className="flex items-center justify-between font-mono text-small">
                <span className="text-fg/70">Progression</span>
                <span className="font-semibold text-accent">{pct}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-fg/10">
                <div
                  className={`h-full rounded-full ${pct >= 100 ? "bg-accent" : "bg-blue"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <dl className="mt-4 divide-y divide-fg/10 text-small">
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-fg/55">Session</dt>
                <dd className="text-right font-semibold text-fg">
                  {inscription.sprint?.name ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-fg/55">Forfait</dt>
                <dd className="font-mono text-fg">
                  {inscription.plan === "DUO" ? "Duo (2 places)" : "Solo (1 place)"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-fg/55">Total dû</dt>
                <dd className="font-mono text-fg">{montant(inscription.totalAmountXof)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-fg/55">Déjà payé</dt>
                <dd className="font-mono font-semibold text-accent">{montant(paye)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-fg/55">Reste à payer</dt>
                <dd className="font-mono font-semibold text-fg">{montant(reste)}</dd>
              </div>
              {reste > 0 || inscription.partialTermsAcceptedAt ? (
                <>
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-fg/55">Conditions paiement partiel</dt>
                    <dd className="text-right font-mono text-fg">
                      {inscription.partialTermsAcceptedAt
                        ? `Approuvées (${date(inscription.partialTermsAcceptedAt)})`
                        : "Non approuvées"}
                    </dd>
                  </div>
                  {paye > 0 && reste > 0 ? (
                    <div className="flex justify-between gap-4 py-2">
                      <dt className="text-fg/55">Remboursement si quota atteint (2/3)</dt>
                      <dd className="text-right font-mono text-fg">
                        {montant(Math.floor((paye * 2) / 3))} (sinon non garanti)
                      </dd>
                    </div>
                  ) : null}
                </>
              ) : null}
            </dl>
          </section>

          <section className="mt-5">
            <p className="font-mono text-small uppercase tracking-[0.16em] text-accent">
              Participant &amp; Contact
            </p>
            <dl className="mt-2 divide-y divide-fg/10 rounded-field border border-fg/10 bg-bg/35 px-4 text-small">
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-fg/55">E-mail</dt>
                <dd className="font-mono text-fg">{inscription.student?.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-fg/55">Téléphone</dt>
                <dd className="font-mono text-fg">{inscription.student?.phone ?? "—"}</dd>
              </div>
              {inscription.plan === "DUO" ? (
                <div className="flex justify-between gap-4 py-2.5">
                  <dt className="text-fg/55">Binôme</dt>
                  <dd className="text-right text-fg">
                    {[inscription.partnerFirstName, inscription.partnerLastName]
                      .filter(Boolean)
                      .join(" ") || "—"}
                    {inscription.partnerPhone ? (
                      <span className="block font-mono text-fg/50">
                        {inscription.partnerPhone}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {cibles.length > 0 ? (
            <section className="mt-5">
              <p className="font-mono text-small uppercase tracking-[0.16em] text-fg/50">
                Changer le statut
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {cibles.map((c) => (
                  <BoutonStatut key={c} id={inscription.id} vers={c} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <p className="font-mono text-small uppercase tracking-[0.16em] text-fg/50">
              Paiements ({paiements.length})
            </p>
            {paiements.length > 0 ? (
              <div className="mt-2.5 flex flex-col gap-2.5">
                {paiements.map((p, i) => (
                  <div
                    key={p.id ?? p.reference ?? i}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-field
                               border border-fg/10 bg-bg/45 px-4 py-3 text-small"
                  >
                    <div>
                      <p className="font-mono font-semibold text-fg">{p.reference}</p>
                      <p className="mt-0.5 font-mono text-fg/45">
                        {date(p.paidAt ?? p.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-fg">
                        {montant(p.amountXof)}
                      </span>
                      <PastillePaiement statut={p.status} />
                      {p.status === "PENDING" ? <BoutonReverifier id={p.id} /> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 font-mono text-small text-fg/45">
                Aucun versement enregistré pour ce dossier.
              </p>
            )}
          </section>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-fg/10 bg-bg/40 px-6 py-4">
          <Link
            href={`/admin/inscriptions/${inscription.id}`}
            className="font-mono text-small text-fg/60 transition-colors hover:text-accent"
          >
            Ouvrir la fiche complète →
          </Link>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-field bg-cta px-5 py-2 font-mono text-small font-bold
                       text-fg transition-opacity hover:opacity-90"
          >
            Fermer
          </button>
        </footer>
      </aside>
    </div>
  );
}

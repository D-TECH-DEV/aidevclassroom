"use client";

import { useState } from "react";
import Link from "next/link";
import {
  date,
  montant,
  nomEtudiant,
  type Inscription,
  type Paiement,
} from "@/lib/admin/types";
import {
  Cellule,
  Ligne,
  PastilleInscription,
  PastillePaiement,
  Tableau,
  Vide,
} from "./Briques";
import { VoletDetailInscription } from "./VoletDetailInscription";

export function TableauActiviteRecente({
  inscriptions,
  paiements,
}: {
  inscriptions: Inscription[];
  paiements: Paiement[];
}) {
  const [onglet, setOnglet] = useState<"inscriptions" | "paiements">(
    "inscriptions",
  );
  const [selection, setSelection] = useState<Inscription | null>(null);

  const lienTout =
    onglet === "inscriptions" ? "/admin/inscriptions" : "/admin/paiements";

  return (
    <section className="rounded-card border border-fg/15 bg-surface">
      <header
        className="flex flex-wrap items-center justify-between gap-3
                   border-b border-fg/10 px-[clamp(1rem,3vw,1.5rem)] py-3.5"
      >
        <div
          role="tablist"
          aria-label="Activité récente"
          className="inline-flex items-center gap-1 rounded-field border
                     border-fg/15 bg-bg/60 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={onglet === "inscriptions"}
            onClick={() => setOnglet("inscriptions")}
            className={`rounded-field px-3.5 py-1.5 font-mono text-small
                        transition-colors ${
                          onglet === "inscriptions"
                            ? "bg-accent/15 font-semibold text-accent border border-accent/40"
                            : "text-fg/60 hover:text-fg border border-transparent"
                        }`}
          >
            Dernières inscriptions ({inscriptions.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={onglet === "paiements"}
            onClick={() => setOnglet("paiements")}
            className={`rounded-field px-3.5 py-1.5 font-mono text-small
                        transition-colors ${
                          onglet === "paiements"
                            ? "bg-accent/15 font-semibold text-accent border border-accent/40"
                            : "text-fg/60 hover:text-fg border border-transparent"
                        }`}
          >
            Derniers paiements ({paiements.length})
          </button>
        </div>

        <Link
          href={lienTout}
          className="font-mono text-small text-accent hover:underline"
        >
          Tout voir →
        </Link>
      </header>

      {onglet === "inscriptions" ? (
        inscriptions.length ? (
          <Tableau
            entetes={["Participant", "Session", "Statut", "Reste", "Date"]}
          >
            {inscriptions.map((i) => (
              <Ligne key={i.id}>
                <Cellule>
                  <button
                    type="button"
                    onClick={() => setSelection(i)}
                    className="text-left text-fg underline decoration-fg/25 underline-offset-4 hover:text-accent"
                  >
                    {nomEtudiant(i.student)}
                  </button>
                </Cellule>
                <Cellule sourd>{i.sprint?.name ?? "—"}</Cellule>
                <Cellule>
                  <PastilleInscription statut={i.status} />
                </Cellule>
                <Cellule mono>
                  <span className="whitespace-nowrap">
                    {montant(i.remainingAmountXof)}
                  </span>
                </Cellule>
                <Cellule mono sourd>
                  <span className="whitespace-nowrap">{date(i.createdAt)}</span>
                </Cellule>
              </Ligne>
            ))}
          </Tableau>
        ) : (
          <Vide>Aucune inscription pour l&apos;instant.</Vide>
        )
      ) : paiements.length ? (
        <Tableau
          entetes={["Référence", "Participant", "Montant", "Statut", "Date"]}
        >
          {paiements.map((p) => (
            <Ligne key={p.id}>
              <Cellule mono>
                {p.enrollment?.id ? (
                  <Link
                    href={`/admin/inscriptions/${p.enrollment.id}`}
                    className="text-fg underline decoration-fg/25 underline-offset-4 hover:text-accent"
                  >
                    {p.reference}
                  </Link>
                ) : (
                  p.reference
                )}
              </Cellule>
              <Cellule>{nomEtudiant(p.enrollment?.student)}</Cellule>
              <Cellule mono>
                <span className="whitespace-nowrap">
                  {montant(p.amountXof)}
                </span>
              </Cellule>
              <Cellule>
                <PastillePaiement statut={p.status} />
              </Cellule>
              <Cellule mono sourd>
                <span className="whitespace-nowrap">
                  {date(p.paidAt ?? p.createdAt)}
                </span>
              </Cellule>
            </Ligne>
          ))}
        </Tableau>
      ) : (
        <Vide>Aucun paiement pour l&apos;instant.</Vide>
      )}

      <VoletDetailInscription
        inscription={selection}
        onFermer={() => setSelection(null)}
      />
    </section>
  );
}

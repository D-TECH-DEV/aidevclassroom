"use client";

import { useState } from "react";
import {
  date,
  montant,
  nomEtudiant,
  type Inscription,
} from "@/lib/admin/types";
import { Cellule, Ligne, PastilleInscription, Tableau } from "./Briques";
import { VoletDetailInscription } from "./VoletDetailInscription";

export function TableauInscriptionsClient({
  items,
  variante = "global",
}: {
  items: Inscription[];
  variante?: "global" | "sprint";
}) {
  const [selection, setSelection] = useState<Inscription | null>(null);

  const entetes =
    variante === "sprint"
      ? [
          "Participant",
          "Forfait",
          "Statut",
          "Progression paiement",
          "Encaissé / Total",
          "Reste",
          "Dossier",
        ]
      : [
          "Participant",
          "Contact",
          "Session",
          "Statut",
          "Payé",
          "Reste",
          "Inscrit le",
        ];

  return (
    <>
      <Tableau entetes={entetes}>
        {items.map((i) => {
          const paye = i.totalPaidXof ?? 0;
          const reste = i.remainingAmountXof ?? 0;
          const pct =
            i.totalAmountXof > 0
              ? Math.min(100, Math.round((paye / i.totalAmountXof) * 100))
              : 0;

          if (variante === "sprint") {
            return (
              <Ligne key={i.id}>
                <Cellule>
                  <button
                    type="button"
                    onClick={() => setSelection(i)}
                    className="text-left outline-none group"
                  >
                    <span className="block font-semibold text-fg transition-colors group-hover:text-accent">
                      {nomEtudiant(i.student)}
                    </span>
                    <span className="block font-mono text-small text-fg/45">
                      {i.student?.email ?? "—"}
                    </span>
                  </button>
                </Cellule>
                <Cellule mono>
                  {i.plan === "DUO" ? "Duo (2)" : "Solo (1)"}
                </Cellule>
                <Cellule>
                  <PastilleInscription statut={i.status} />
                </Cellule>
                <Cellule>
                  <div className="min-w-[140px]">
                    <div className="flex items-center justify-between font-mono text-small">
                      <span className="font-semibold text-fg">{pct}%</span>
                      <span className="text-fg/45">
                        {pct === 100 ? "Soldé" : "En cours"}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-fg/10">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 100 ? "bg-accent" : "bg-blue"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </Cellule>
                <Cellule mono>
                  <span className="block text-fg">{montant(paye)}</span>
                  <span className="block text-fg/45">
                    / {montant(i.totalAmountXof)}
                  </span>
                </Cellule>
                <Cellule mono sourd>
                  {montant(reste)}
                </Cellule>
                <Cellule>
                  <button
                    type="button"
                    onClick={() => setSelection(i)}
                    className="font-mono text-small text-accent hover:underline"
                  >
                    Détails →
                  </button>
                </Cellule>
              </Ligne>
            );
          }

          return (
            <Ligne key={i.id}>
              <Cellule>
                <button
                  type="button"
                  onClick={() => setSelection(i)}
                  className="text-left text-fg underline decoration-fg/25 underline-offset-4 transition-colors hover:text-accent"
                >
                  {nomEtudiant(i.student)}
                </button>
              </Cellule>
              <Cellule mono sourd>
                {i.student?.email ?? "—"}
                {i.student?.phone ? (
                  <span className="block text-fg/40">{i.student.phone}</span>
                ) : null}
              </Cellule>
              <Cellule sourd>{i.sprint?.name ?? "—"}</Cellule>
              <Cellule>
                <PastilleInscription statut={i.status} />
              </Cellule>
              <Cellule mono>{montant(i.totalPaidXof)}</Cellule>
              <Cellule mono>{montant(i.remainingAmountXof)}</Cellule>
              <Cellule mono sourd>
                {date(i.createdAt)}
              </Cellule>
            </Ligne>
          );
        })}
      </Tableau>

      <VoletDetailInscription
        inscription={selection}
        onFermer={() => setSelection(null)}
      />
    </>
  );
}

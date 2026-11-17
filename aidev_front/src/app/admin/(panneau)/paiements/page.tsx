import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  exigeSession,
  paiements,
  sessionPerdue,
  sprints,
  traduitAdmin,
} from "@/lib/admin/api";
import {
  date,
  montant,
  nomEtudiant,
  LIBELLE_PAIEMENT,
  type Paiement,
  type StatutPaiement,
} from "@/lib/admin/types";
import {
  Alerte,
  Cellule,
  EnTetePage,
  Ligne,
  Pagination,
  PastillePaiement,
  Tableau,
  Vide,
} from "@/components/admin/Briques";
import { Filtres } from "@/components/admin/Filtres";
import { BoutonReverifier } from "@/components/admin/BoutonAction";
import { BoutonExporterExcel } from "@/components/admin/BoutonExporterExcel";

/**
 * `/admin/paiements` — tous les versements.
 *
 * Le bouton « Revérifier » est la raison d'être de cet écran. Si un
 * webhook Paystack se perd, un paiement réellement encaissé reste
 * `PENDING` chez nous et la place paraît impayée. `recheck` redemande son
 * avis à Paystack et remet la base d'aplomb, sans toucher au SQL.
 */

const STATUTS = (
  ["PENDING", "SUCCESS", "FAILED", "ABANDONED"] as StatutPaiement[]
).map((valeur) => ({ valeur, libelle: LIBELLE_PAIEMENT[valeur] }));

type Params = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function PagePaiements({ searchParams }: Params) {
  return (
    <>
      <EnTetePage
        surtitre="Encaissements"
        titre="Paiements"
        description="Historique des transactions Paystack et relance de vérification."
        action={
          <Suspense fallback={null}>
            <BoutonExporterExcel endpoint="/admin/api/export/paiements" />
          </Suspense>
        }
      />

      <Suspense
        fallback={
          <p className="mt-6 font-mono text-small text-fg/45">Chargement…</p>
        }
      >
        <Contenu searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function premier(valeur: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return v && v.length > 0 ? v : undefined;
}

async function Contenu({ searchParams }: Params) {
  await exigeSession();

  const params = await searchParams;
  const statut = premier(params.statut);
  const reference = premier(params.reference);
  const brutSprintId = premier(params.sprintId);
  const sprintId = brutSprintId ? Number(brutSprintId) : undefined;
  const sprintIdValide =
    sprintId !== undefined && Number.isInteger(sprintId) && sprintId > 0
      ? sprintId
      : undefined;
  const page = Math.max(1, Number(premier(params.page) ?? 1) || 1);

  let liste;
  let listeSprints;
  try {
    [liste, listeSprints] = await Promise.all([
      paiements({ page, statut, reference, sprintId: sprintIdValide }),
      sprints({ limit: 100 }),
    ]);
  } catch (cause) {
    if (sessionPerdue(cause)) redirect("/admin/connexion");
    return (
      <div className="mt-6">
        <Alerte>{traduitAdmin(cause)}</Alerte>
      </div>
    );
  }

  const optionsSprints = (listeSprints?.items ?? []).filter(
    (sp) => sp.status === "ACTIVE" || (sp.enrolledCount ?? 0) > 0,
  );

  return (
    <>
      <div className="mt-[clamp(1.25rem,3svh,2rem)]">
        <Filtres
          action="/admin/paiements"
          statuts={STATUTS}
          statutActuel={statut}
          sprints={optionsSprints}
          sprintActuel={sprintIdValide ? String(sprintIdValide) : undefined}
          nomRecherche="reference"
          valeurRecherche={reference}
          placeholder="Référence Paystack"
        />
      </div>

      <section className="mt-[clamp(1.25rem,3svh,2rem)] rounded-card border border-fg/15 bg-surface">
        {liste.items.length ? (
          <>
            <Tableau
              entetes={[
                "Référence",
                "Montant",
                "Statut",
                "Participant",
                "Payé le",
                "",
              ]}
            >
              {liste.items.map((p: Paiement) => (
                <Ligne key={p.id}>
                  <Cellule mono>
                    <span className="select-all">{p.reference}</span>
                  </Cellule>
                  <Cellule mono>{montant(p.amountXof)}</Cellule>
                  <Cellule>
                    <PastillePaiement statut={p.status} />
                  </Cellule>
                  <Cellule sourd>
                    {p.enrollment ? (
                      <Link
                        href={`/admin/inscriptions/${p.enrollment.id}`}
                        className="text-fg/85 underline decoration-fg/25 underline-offset-4"
                      >
                        {nomEtudiant(p.enrollment.student)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Cellule>
                  <Cellule mono sourd>
                    {date(p.paidAt)}
                  </Cellule>
                  <Cellule>
                    {/* Seul un paiement non abouti mérite qu'on redemande :
                        relancer un SUCCESS ne change rien. */}
                    {p.status === "PENDING" ? (
                      <BoutonReverifier id={p.id} />
                    ) : null}
                  </Cellule>
                </Ligne>
              ))}
            </Tableau>

            <Pagination
              base="/admin/paiements"
              page={liste.page}
              limit={liste.limit}
              total={liste.total}
              parametres={{
                statut,
                reference,
                sprintId: sprintIdValide ? String(sprintIdValide) : undefined,
              }}
            />
          </>
        ) : (
          <Vide>
            {statut || reference || sprintIdValide
              ? "Aucun paiement ne correspond à ce filtre."
              : "Aucun paiement enregistré pour l'instant."}
          </Vide>
        )}
      </section>
    </>
  );
}

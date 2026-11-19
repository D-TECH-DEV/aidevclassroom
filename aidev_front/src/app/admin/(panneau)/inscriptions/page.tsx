import { Suspense } from "react";
import { redirect } from "next/navigation";

import {
  exigeSession,
  inscriptions,
  sessionPerdue,
  sprints,
  traduitAdmin,
} from "@/lib/admin/api";
import {
  LIBELLE_INSCRIPTION,
  type StatutInscription,
} from "@/lib/admin/types";
import {
  Alerte,
  EnTetePage,
  Pagination,
  Vide,
} from "@/components/admin/Briques";
import { Filtres } from "@/components/admin/Filtres";
import { BoutonExporterExcel } from "@/components/admin/BoutonExporterExcel";
import { TableauInscriptionsClient } from "@/components/admin/TableauInscriptionsClient";

/**
 * `/admin/inscriptions` — la liste, filtrable.
 *
 * Les filtres vivent dans l'adresse (`?statut=&search=&page=`) : une
 * recherche se partage, se met en favori, et le bouton « retour » du
 * navigateur fait ce qu'on attend de lui.
 */

const STATUTS = (
  ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as StatutInscription[]
).map((valeur) => ({ valeur, libelle: LIBELLE_INSCRIPTION[valeur] }));

type Params = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function PageInscriptions({ searchParams }: Params) {
  return (
    <>
      <EnTetePage
        surtitre="Participants"
        titre="Inscriptions"
        description="Suivi des dossiers Solo et Duo, soldes restants et validations."
        action={
          <Suspense fallback={null}>
            <BoutonExporterExcel endpoint="/admin/api/export/inscriptions" />
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

/** Un paramètre d'adresse peut arriver en tableau : on garde le premier. */
function premier(valeur: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return v && v.length > 0 ? v : undefined;
}

async function Contenu({ searchParams }: Params) {
  await exigeSession();

  const params = await searchParams;
  const statut = premier(params.statut);
  const recherche = premier(params.search);
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
      inscriptions({ page, statut, recherche, sprintId: sprintIdValide }),
      sprints({ limit: 100 }),
    ]);
  } catch (cause) {
    if (sessionPerdue(cause)) redirect("/admin/connexion?expiree=1");
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
          action="/admin/inscriptions"
          statuts={STATUTS}
          statutActuel={statut}
          sprints={optionsSprints}
          sprintActuel={sprintIdValide ? String(sprintIdValide) : undefined}
          nomRecherche="search"
          valeurRecherche={recherche}
          placeholder="Nom, prénom ou e-mail"
        />
      </div>

      <section className="mt-[clamp(1.25rem,3svh,2rem)] rounded-card border border-fg/15 bg-surface">
        {liste.items.length ? (
          <>
            <TableauInscriptionsClient items={liste.items} />

            <Pagination
              base="/admin/inscriptions"
              page={liste.page}
              limit={liste.limit}
              total={liste.total}
              parametres={{
                statut,
                search: recherche,
                sprintId: sprintIdValide ? String(sprintIdValide) : undefined,
              }}
            />
          </>
        ) : (
          <Vide>
            {statut || recherche || sprintIdValide
              ? "Aucune inscription ne correspond à ce filtre."
              : "Aucune inscription enregistrée pour l'instant."}
          </Vide>
        )}
      </section>
    </>
  );
}

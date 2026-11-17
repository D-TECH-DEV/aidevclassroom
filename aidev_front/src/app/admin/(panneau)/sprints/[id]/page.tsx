import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  exigeSession,
  inscriptions,
  sessionPerdue,
  sprint,
  traduitAdmin,
} from "@/lib/admin/api";
import {
  date,
  LIBELLE_INSCRIPTION,
  montant,
  type Inscription,
  type Sprint,
  type StatutInscription,
} from "@/lib/admin/types";
import {
  Alerte,
  Cadre,
  EnTetePage,
  Pagination,
  PastilleSprint,
  Tuile,
  Vide,
} from "@/components/admin/Briques";
import { BoutonExporterExcel } from "@/components/admin/BoutonExporterExcel";
import { Filtres } from "@/components/admin/Filtres";
import { TableauInscriptionsClient } from "@/components/admin/TableauInscriptionsClient";

const STATUTS = (
  ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as StatutInscription[]
).map((valeur) => ({ valeur, libelle: LIBELLE_INSCRIPTION[valeur] }));

export default async function PageDetailSprint({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    statut?: string;
    search?: string;
  }>;
}) {
  await exigeSession();

  const { id } = await params;
  const sprintId = Number(id);
  if (!Number.isInteger(sprintId) || sprintId <= 0) {
    notFound();
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const statut = sp.statut?.trim() || undefined;
  const recherche = sp.search?.trim() || undefined;

  let donneesSprint: Sprint | null = null;
  let liste: {
    items: Inscription[];
    total: number;
    page: number;
    limit: number;
  } = { items: [], total: 0, page, limit: 50 };
  let erreur: string | null = null;

  try {
    const [s, ins] = await Promise.all([
      sprint(sprintId),
      inscriptions({ sprintId, page, statut, recherche, limit: 50 }),
    ]);
    donneesSprint = s;
    liste = ins;
  } catch (cause) {
    if (sessionPerdue(cause)) redirect("/admin/connexion");
    erreur = traduitAdmin(cause);
  }

  if (!donneesSprint && !erreur) {
    notFound();
  }

  const totalDu = liste.items.reduce((acc, i) => acc + i.totalAmountXof, 0);
  const totalPaye = liste.items.reduce(
    (acc, i) => acc + (i.totalPaidXof ?? 0),
    0,
  );
  const totalReste = liste.items.reduce(
    (acc, i) => acc + (i.remainingAmountXof ?? 0),
    0,
  );
  const placesOccupees = donneesSprint?.enrolledSeats ?? 0;
  const capacite =
    typeof donneesSprint?.capacity === "number"
      ? `${placesOccupees} / ${donneesSprint.capacity}`
      : `${placesOccupees} / —`;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/admin/sprints"
          className="font-mono text-small text-fg/60 transition-colors hover:text-accent"
        >
          ← Retour aux sprints
        </Link>
      </div>

      <EnTetePage
        surtitre="Détail de la session"
        titre={donneesSprint?.name ?? `Sprint #${sprintId}`}
        description={
          donneesSprint
            ? `${donneesSprint.slug}${donneesSprint.city ? ` · ${donneesSprint.city}` : ""} · ${date(donneesSprint.startAt)} → ${date(donneesSprint.endAt)}`
            : undefined
        }
        action={
          <div className="flex flex-wrap items-center gap-3">
            {donneesSprint ? (
              <PastilleSprint statut={donneesSprint.status} />
            ) : null}
            <Suspense fallback={null}>
              <BoutonExporterExcel
                endpoint="/admin/api/export/inscriptions"
                sprintId={sprintId}
              />
            </Suspense>
          </div>
        }
      />

      {erreur ? (
        <div className="mt-6">
          <Alerte>{erreur}</Alerte>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tuile
          libelle="Places occupées"
          valeur={capacite}
          precision={`${donneesSprint?.enrolledCount ?? liste.total} dossier(s) actifs`}
        />
        <Tuile
          libelle="Inscriptions affichées"
          valeur={String(liste.total)}
          precision={statut || recherche ? "Selon filtre actif" : "Tous statuts confondus"}
        />
        <Tuile
          libelle="Montant encaissé"
          valeur={montant(totalPaye)}
          precision={`sur ${montant(totalDu)} attendus`}
          accent
        />
        <Tuile
          libelle="Reste à percevoir"
          valeur={montant(totalReste)}
          precision="Sur la page affichée"
        />
      </div>

      <div className="mt-6">
        <Filtres
          action={`/admin/sprints/${sprintId}`}
          statuts={STATUTS}
          statutActuel={statut}
          nomRecherche="search"
          valeurRecherche={recherche}
          placeholder="Nom, prénom ou e-mail"
        />
      </div>

      <div className="mt-6">
        <Cadre
          titre={`Inscrits (${liste.total})`}
          action={
            <span className="font-mono text-small text-fg/50">
              Cliquez sur un participant pour ouvrir son volet de paiements
            </span>
          }
        >
          {liste.items.length ? (
            <>
              <TableauInscriptionsClient
                items={liste.items}
                variante="sprint"
              />

              <Pagination
                base={`/admin/sprints/${sprintId}`}
                page={liste.page}
                limit={liste.limit}
                total={liste.total}
                parametres={{ statut, search: recherche }}
              />
            </>
          ) : (
            <Vide>
              {statut || recherche
                ? "Aucun inscrit ne correspond à ce filtre pour ce sprint."
                : "Aucune inscription enregistrée pour ce sprint."}
            </Vide>
          )}
        </Cadre>
      </div>
    </>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  exigeSession,
  inscriptions,
  selectionSprint,
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
import { BoutonModifierSprint } from "@/components/admin/ActionsSprint";
import { Filtres } from "@/components/admin/Filtres";
import { PanelSelectionSprint } from "@/components/admin/PanelSelectionSprint";
import { TableauInscriptionsClient } from "@/components/admin/TableauInscriptionsClient";
import { ToastNotificationMail } from "@/components/admin/ToastNotificationMail";

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
    onglet?: string;
    group?: string;
  }>;
}) {
  await exigeSession();

  const { id } = await params;
  const sprintId = Number(id);
  if (!Number.isInteger(sprintId) || sprintId <= 0) {
    notFound();
  }

  const sp = await searchParams;
  const onglet = sp.onglet === "selection" ? "selection" : "inscrits";
  const group =
    sp.group === "waitlist" || sp.group === "unpaid" ? sp.group : "selected";
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
  let donneesSelection: Awaited<ReturnType<typeof selectionSprint>> | null =
    null;
  let erreur: string | null = null;

  try {
    if (onglet === "selection") {
      donneesSelection = await selectionSprint(sprintId, {
        group,
        page,
        limit: 50,
        search: recherche,
      });
      donneesSprint = donneesSelection.sprint;
    } else {
      const [s, ins] = await Promise.all([
        sprint(sprintId),
        inscriptions({ sprintId, page, statut, recherche, limit: 50 }),
      ]);
      donneesSprint = s;
      liste = ins;
    }
  } catch (cause) {
    if (sessionPerdue(cause)) redirect("/admin/connexion?expiree=1");
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
              <>
                <PastilleSprint statut={donneesSprint.status} />
                <BoutonModifierSprint sprint={donneesSprint} />
              </>
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

      <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-fg/10 pb-3">
        <Link
          href={`/admin/sprints/${sprintId}`}
          className={`rounded-field border px-4 py-2 font-mono text-small transition-colors ${
            onglet === "inscrits"
              ? "border-accent/60 bg-accent/15 font-semibold text-accent"
              : "border-fg/20 bg-bg/60 text-fg/75 hover:border-fg/40 hover:text-fg"
          }`}
        >
          Inscrits
        </Link>
        <Link
          href={`/admin/sprints/${sprintId}?onglet=selection`}
          className={`rounded-field border px-4 py-2 font-mono text-small transition-colors ${
            onglet === "selection"
              ? "border-accent/60 bg-accent/15 font-semibold text-accent"
              : "border-fg/20 bg-bg/60 text-fg/75 hover:border-fg/40 hover:text-fg"
          }`}
        >
          Sélection &amp; Places
        </Link>
        <Link
          href="/admin/sprints?vue=notifications"
          className="rounded-field border border-fg/20 bg-bg/60 px-4 py-2 font-mono text-small text-fg/75 transition-colors hover:border-accent/50 hover:text-fg"
        >
          Historique des e-mails
        </Link>
      </div>

      {erreur ? (
        <div className="mt-6">
          <Alerte>{erreur}</Alerte>
        </div>
      ) : null}

      {onglet === "selection" && donneesSelection ? (
        <PanelSelectionSprint
          sprintId={sprintId}
          selection={donneesSelection}
          rechercheActuelle={recherche}
        />
      ) : (
        <>
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
      )}

      <ToastNotificationMail />
    </>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  exigeSession,
  inscriptions,
  sessionPerdue,
  traduitAdmin,
} from "@/lib/admin/api";
import {
  date,
  montant,
  nomEtudiant,
  LIBELLE_INSCRIPTION,
  type Inscription,
  type StatutInscription,
} from "@/lib/admin/types";
import {
  Alerte,
  Cellule,
  Ligne,
  Pagination,
  PastilleInscription,
  Surtitre,
  Tableau,
  TitrePage,
  Vide,
} from "@/components/admin/Briques";
import { Filtres } from "@/components/admin/Filtres";

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
      <Surtitre>Participants</Surtitre>
      <TitrePage>Inscriptions</TitrePage>

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
  const page = Math.max(1, Number(premier(params.page) ?? 1) || 1);

  let liste;
  try {
    liste = await inscriptions({ page, statut, recherche });
  } catch (cause) {
    if (sessionPerdue(cause)) redirect("/admin/connexion");
    return (
      <div className="mt-6">
        <Alerte>{traduitAdmin(cause)}</Alerte>
      </div>
    );
  }

  return (
    <>
      <div className="mt-[clamp(1.25rem,3svh,2rem)]">
        <Filtres
          action="/admin/inscriptions"
          statuts={STATUTS}
          statutActuel={statut}
          nomRecherche="search"
          valeurRecherche={recherche}
          placeholder="Nom, prénom ou e-mail"
        />
      </div>

      <section className="mt-[clamp(1.25rem,3svh,2rem)] rounded-card border border-fg/15 bg-surface">
        {liste.items.length ? (
          <>
            <Tableau
              entetes={[
                "Participant",
                "Contact",
                "Session",
                "Statut",
                "Payé",
                "Reste",
                "Inscrit le",
              ]}
            >
              {liste.items.map((i: Inscription) => (
                <Ligne key={i.id}>
                  <Cellule>
                    <Link
                      href={`/admin/inscriptions/${i.id}`}
                      className="text-fg underline decoration-fg/25 underline-offset-4"
                    >
                      {nomEtudiant(i.student)}
                    </Link>
                  </Cellule>
                  <Cellule mono sourd>
                    {i.student?.email ?? "—"}
                    {i.student?.phone ? (
                      <span className="block text-fg/40">
                        {i.student.phone}
                      </span>
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
              ))}
            </Tableau>

            <Pagination
              base="/admin/inscriptions"
              page={liste.page}
              limit={liste.limit}
              total={liste.total}
              parametres={{ statut, search: recherche }}
            />
          </>
        ) : (
          <Vide>
            {statut || recherche
              ? "Aucune inscription ne correspond à ce filtre."
              : "Aucune inscription enregistrée pour l'instant."}
          </Vide>
        )}
      </section>
    </>
  );
}

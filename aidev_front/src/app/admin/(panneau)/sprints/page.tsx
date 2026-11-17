import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  exigeSession,
  sessionPerdue,
  sprints,
  traduitAdmin,
} from "@/lib/admin/api";
import {
  date,
  LIBELLE_SPRINT,
  montant,
  type Sprint,
  type StatutSprint,
} from "@/lib/admin/types";
import {
  Alerte,
  Cadre,
  Cellule,
  EnTetePage,
  Ligne,
  Pagination,
  PastilleSprint,
  Tableau,
  Vide,
} from "@/components/admin/Briques";
import {
  BoutonSupprimerSprint,
  GroupeStatutsSprint,
} from "@/components/admin/BoutonAction";
import {
  BoutonModifierSprint,
  BoutonNouveauSprint,
} from "@/components/admin/ActionsSprint";

/**
 * `/admin/sprints` — la liste des sessions, filtrable par statut.
 *
 * La création et la modification s'effectuent via la modale en 3 étapes
 * (`ModaleSprint`), et les 4 statuts sont pilotables directement par ligne.
 */

const STATUTS = (
  ["DRAFT", "ACTIVE", "INACTIVE", "COMPLETED"] as StatutSprint[]
).map((valeur) => ({ valeur, libelle: LIBELLE_SPRINT[valeur] }));

type Params = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function PageSprints({ searchParams }: Params) {
  return (
    <>
      <EnTetePage
        surtitre="Sessions"
        titre="Sprints"
        description="Créez et configurez vos sessions en 3 étapes, puis pilotez leur statut en un clic. Seuls les sprints lancés sont visibles sur le site public."
        action={<BoutonNouveauSprint />}
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
  const page = Math.max(1, Number(premier(params.page) ?? 1) || 1);

  let liste;
  try {
    liste = await sprints({ page, statut });
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
      <form
        method="get"
        action="/admin/sprints"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-card border
                   border-fg/10 bg-surface/60 p-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-small uppercase tracking-[0.15em] text-fg/45">
            Filtrer par statut
          </span>
          <select
            name="statut"
            defaultValue={statut ?? ""}
            className="rounded-field border border-fg/20 bg-bg px-3 py-2
                       font-mono text-small text-fg outline-none
                       focus-visible:border-accent/60"
          >
            <option value="">Tous les statuts</option>
            {STATUTS.map((s) => (
              <option key={s.valeur} value={s.valeur}>
                {s.libelle}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-field border border-fg/25 bg-bg/70 px-4 py-2
                     font-mono text-small text-fg/85 transition-colors outline-none
                     hover:border-accent/50 hover:text-fg focus-visible:border-fg"
        >
          Filtrer
        </button>
      </form>

      <div className="mt-6">
        <Cadre titre={`${liste.total} sprint${liste.total > 1 ? "s" : ""}`}>
          {liste.items.length ? (
            <>
              <Tableau
                entetes={[
                  "Session",
                  "Tarifs",
                  "Période",
                  "Inscrits / Capacité",
                  "Statut & Pilotage",
                  "Actions",
                ]}
              >
                {liste.items.map((s: Sprint) => {
                  const placesOccupees = s.enrolledSeats ?? 0;
                  const capacite = typeof s.capacity === "number" ? s.capacity : null;
                  const ratio =
                    capacite && capacite > 0
                      ? Math.min(100, Math.round((placesOccupees / capacite) * 100))
                      : 0;
                  return (
                    <Ligne key={s.id}>
                      <Cellule>
                        <Link
                          href={`/admin/sprints/${s.id}`}
                          className="group block min-w-[230px] outline-none"
                        >
                          <span className="block font-bold text-fg/95 transition-colors group-hover:text-accent">
                            {s.name}
                          </span>
                          <span className="mt-0.5 block font-mono text-small text-fg/45">
                            {s.slug}
                            {s.city ? ` · ${s.city}` : ""}
                          </span>
                          <span className="mt-1 inline-block whitespace-nowrap font-mono text-small text-accent/80 group-hover:text-accent">
                            Voir les inscrits →
                          </span>
                        </Link>
                      </Cellule>
                      <Cellule mono>
                        <div className="min-w-[140px]">
                          <span className="block whitespace-nowrap font-semibold text-fg">
                            {montant(s.priceXof)}
                          </span>
                          <span className="block whitespace-nowrap text-fg/45">
                            min {montant(s.minimumPaymentXof)}
                          </span>
                          {s.duoPriceXof != null ? (
                            <span className="block whitespace-nowrap text-fg/55">
                              Duo {montant(s.duoPriceXof)}
                            </span>
                          ) : null}
                        </div>
                      </Cellule>
                      <Cellule mono sourd>
                        <span className="block whitespace-nowrap">
                          {date(s.startAt)}
                        </span>
                        <span className="block whitespace-nowrap text-fg/40">
                          → {date(s.endAt)}
                        </span>
                      </Cellule>
                      <Cellule mono>
                        <div className="min-w-[115px]">
                          <span className="block whitespace-nowrap font-semibold text-fg">
                            {placesOccupees} / {capacite ?? "—"}
                          </span>
                          {capacite && capacite > 0 ? (
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-fg/10">
                              <div
                                className="h-full rounded-full bg-accent transition-all"
                                style={{ width: `${ratio}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </Cellule>
                      <Cellule>
                        <div className="flex flex-col items-start gap-2">
                          <PastilleSprint statut={s.status} />
                          <GroupeStatutsSprint id={s.id} statutActuel={s.status} />
                        </div>
                      </Cellule>
                      <Cellule>
                        <div className="flex flex-col items-start gap-2">
                          <BoutonModifierSprint sprint={s} />
                          <BoutonSupprimerSprint id={s.id} nom={s.name} />
                        </div>
                      </Cellule>
                    </Ligne>
                  );
                })}
              </Tableau>

              <Pagination
                base="/admin/sprints"
                page={liste.page}
                limit={liste.limit}
                total={liste.total}
                parametres={{ statut }}
              />
            </>
          ) : (
            <Vide>
              {statut
                ? "Aucun sprint dans cet état."
                : "Aucun sprint pour l'instant. Créez le premier avec le bouton « Nouveau sprint »."}
            </Vide>
          )}
        </Cadre>
      </div>
    </>
  );
}

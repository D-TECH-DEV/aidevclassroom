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
  TRANSITIONS_SPRINT,
  type Sprint,
  type StatutSprint,
} from "@/lib/admin/types";
import {
  Alerte,
  Cadre,
  Cellule,
  Ligne,
  Pagination,
  PastilleSprint,
  Surtitre,
  Tableau,
  TitrePage,
  Vide,
} from "@/components/admin/Briques";
import {
  BoutonSprint,
  BoutonSupprimerSprint,
} from "@/components/admin/BoutonAction";

/**
 * `/admin/sprints` — la liste des sessions, filtrable par statut.
 *
 * Créer passe par `/admin/sprints/nouveau`. Lancer (ou désactiver,
 * terminer) passe par les boutons de chaque ligne, limités aux
 * transitions que l'API accepte (`TRANSITIONS_SPRINT`).
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
      <Surtitre>Sessions</Surtitre>
      <TitrePage>Sprints</TitrePage>

      <p className="mt-4 max-w-[60ch] text-body text-fg/60">
        Crée un sprint en brouillon, puis lance-le quand les dates et le prix
        sont prêts. Seuls les sprints lancés sont visibles sur le site public.
      </p>

      <div className="mt-6">
        <Link
          href="/admin/sprints/nouveau"
          className="inline-block rounded-field bg-cta px-6 py-3 font-bold
                     text-fg outline-none focus-visible:border focus-visible:border-fg"
        >
          Nouveau sprint
        </Link>
      </div>

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
        className="mt-6 flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-1">
          <span className="font-mono text-small uppercase tracking-[0.15em] text-fg/45">
            Statut
          </span>
          <select
            name="statut"
            defaultValue={statut ?? ""}
            className="rounded-field border border-fg/20 bg-bg px-3 py-2
                       font-mono text-small text-fg outline-none
                       focus-visible:border-accent/60"
          >
            <option value="">Tous</option>
            {STATUTS.map((s) => (
              <option key={s.valeur} value={s.valeur}>
                {s.libelle}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-field border border-fg/25 px-4 py-2 font-mono
                     text-small text-fg/80 outline-none focus-visible:border-fg"
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
                  "Nom",
                  "Prix",
                  "Minimum",
                  "Duo",
                  "Période",
                  "Capacité",
                  "Statut",
                  "Actions",
                ]}
              >
                {liste.items.map((s: Sprint) => (
                  <Ligne key={s.id}>
                    <Cellule>
                      <span className="block font-bold text-fg/90">
                        {s.name}
                      </span>
                      <span className="block font-mono text-small text-fg/40">
                        {s.slug}
                      </span>
                    </Cellule>
                    <Cellule mono>{montant(s.priceXof)}</Cellule>
                    <Cellule mono>{montant(s.minimumPaymentXof)}</Cellule>
                    <Cellule mono>
                      {s.duoPriceXof != null ? (
                        <>
                          {montant(s.duoPriceXof)}
                          <span className="block text-fg/40">
                            min{" "}
                            {s.duoMinimumPaymentXof != null
                              ? montant(s.duoMinimumPaymentXof)
                              : montant(s.minimumPaymentXof)}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
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
                      {typeof s.capacity === "number" ? s.capacity : "—"}
                    </Cellule>
                    <Cellule>
                      <PastilleSprint statut={s.status} />
                    </Cellule>
                    <Cellule>
                      <div className="flex flex-col items-start gap-2">
                        <Link
                          href={`/admin/sprints/${s.id}/modifier`}
                          className="rounded-field border border-fg/25 px-3 py-1.5
                                     font-mono text-small text-fg/80 outline-none
                                     focus-visible:border-fg"
                        >
                          Modifier
                        </Link>
                        {TRANSITIONS_SPRINT[s.status].map((vers) => (
                          <BoutonSprint key={vers} id={s.id} vers={vers} />
                        ))}
                        {TRANSITIONS_SPRINT[s.status].length === 0 ? (
                          <span className="font-mono text-small text-fg/40">
                            —
                          </span>
                        ) : null}
                        <BoutonSupprimerSprint id={s.id} />
                      </div>
                    </Cellule>
                  </Ligne>
                ))}
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
                : "Aucun sprint pour l'instant. Crée le premier avec le bouton ci-dessus."}
            </Vide>
          )}
        </Cadre>
      </div>
    </>
  );
}

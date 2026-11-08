import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  exigeSession,
  inscription,
  sessionPerdue,
  traduitAdmin,
} from "@/lib/admin/api";
import { ErreurApi } from "@/lib/api";
import {
  date,
  montant,
  nomEtudiant,
  TRANSITIONS,
  type Paiement,
} from "@/lib/admin/types";
import {
  Alerte,
  Cadre,
  Cellule,
  Ligne,
  PastilleInscription,
  PastillePaiement,
  Surtitre,
  Tableau,
  TitrePage,
  Vide,
} from "@/components/admin/Briques";
import { BoutonStatut } from "@/components/admin/BoutonAction";

/**
 * `/admin/inscriptions/:id` — la fiche d'une inscription.
 *
 * Le détail porte déjà les paiements et les soldes : pas besoin
 * d'appeler `/admin/enrollments/:id/payments` en plus.
 *
 * Les boutons de statut n'affichent que les transitions que l'API
 * accepte depuis l'état courant. `COMPLETED` dépend en plus d'un solde à
 * zéro, ce qu'on vérifie ici pour ne pas proposer un bouton qui mènerait
 * droit à un `ENROLLMENT_NOT_SETTLED`.
 */

type Params = { params: Promise<{ id: string }> };

export default function PageInscription({ params }: Params) {
  return (
    <Suspense
      fallback={
        <p className="font-mono text-small text-fg/45">Chargement…</p>
      }
    >
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: Params) {
  await exigeSession();

  const { id: brut } = await params;
  const id = Number(brut);
  if (!Number.isInteger(id) || id <= 0) return <Introuvable />;

  let fiche;
  try {
    fiche = await inscription(id);
  } catch (cause) {
    if (sessionPerdue(cause)) redirect("/admin/connexion");
    if (cause instanceof ErreurApi && cause.statusCode === 404) {
      return <Introuvable />;
    }
    return <Alerte>{traduitAdmin(cause)}</Alerte>;
  }

  const reste = fiche.remainingAmountXof;
  const solde = reste === 0;

  /**
   * On retire `COMPLETED` tant que le solde n'est pas à zéro — ou tant
   * qu'on ne sait pas, parce que la doc ne garantit pas le champ.
   */
  const cibles = TRANSITIONS[fiche.status].filter(
    (c) => c !== "COMPLETED" || solde,
  );

  return (
    <>
      <Link
        href="/admin/inscriptions"
        className="font-mono text-small text-fg/50"
      >
        ← Toutes les inscriptions
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Surtitre>Inscription n° {fiche.id}</Surtitre>
          <TitrePage>{nomEtudiant(fiche.student)}</TitrePage>
        </div>
        <PastilleInscription statut={fiche.status} />
      </div>

      <div
        className="mt-[clamp(1.5rem,4svh,2.5rem)] grid gap-[clamp(1rem,3svh,2rem)]
                   lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
      >
        <div className="flex flex-col gap-[clamp(1rem,3svh,2rem)]">
          <Cadre titre="Paiements">
            {fiche.payments?.length ? (
              <Tableau
                entetes={["Référence", "Montant", "Statut", "Payé le", "Créé le"]}
              >
                {fiche.payments.map((p: Paiement) => (
                  <Ligne key={p.id}>
                    <Cellule mono>
                      <span className="select-all">{p.reference}</span>
                    </Cellule>
                    <Cellule mono>{montant(p.amountXof)}</Cellule>
                    <Cellule>
                      <PastillePaiement statut={p.status} />
                    </Cellule>
                    <Cellule mono sourd>
                      {date(p.paidAt)}
                    </Cellule>
                    <Cellule mono sourd>
                      {date(p.createdAt)}
                    </Cellule>
                  </Ligne>
                ))}
              </Tableau>
            ) : (
              <Vide>
                Aucun versement. L&apos;inscription existe, rien n&apos;a
                encore été encaissé.
              </Vide>
            )}
          </Cadre>

          <Cadre titre="Changer le statut">
            <div className="flex flex-wrap items-start gap-3 px-[clamp(1rem,3vw,1.5rem)] py-[clamp(1rem,3svh,1.5rem)]">
              {cibles.length ? (
                cibles.map((c) => (
                  <BoutonStatut key={c} id={fiche.id} vers={c} />
                ))
              ) : (
                <p className="text-body text-fg/50">
                  {fiche.status === "CONFIRMED" && !solde
                    ? "Pour terminer cette inscription, il faut d'abord que le solde soit réglé."
                    : "Cet état est définitif : l'API n'accepte plus aucune transition."}
                </p>
              )}
            </div>
          </Cadre>
        </div>

        <aside className="flex flex-col gap-[clamp(1rem,3svh,2rem)]">
          <Cadre titre="Compte">
            <dl className="flex flex-col gap-3 px-[clamp(1rem,3vw,1.5rem)] py-[clamp(1rem,3svh,1.5rem)]">
              <Ligne2 cle="Total dû" valeur={montant(fiche.totalAmountXof)} />
              <Ligne2 cle="Déjà payé" valeur={montant(fiche.totalPaidXof)} />
              <Ligne2
                cle="Reste"
                valeur={montant(reste)}
                accent={reste !== undefined && reste > 0}
              />
            </dl>
          </Cadre>

          <Cadre titre="Participant">
            <dl className="flex flex-col gap-3 px-[clamp(1rem,3vw,1.5rem)] py-[clamp(1rem,3svh,1.5rem)]">
              <Ligne2 cle="Nom" valeur={nomEtudiant(fiche.student)} />
              <Ligne2 cle="E-mail" valeur={fiche.student?.email ?? "—"} />
              <Ligne2 cle="Téléphone" valeur={fiche.student?.phone ?? "—"} />
              <Ligne2 cle="Session" valeur={fiche.sprint?.name ?? "—"} />
              <Ligne2
                cle="Forfait"
                valeur={fiche.plan === "DUO" ? "Duo — 2 places" : "Solo"}
              />
              {fiche.plan === "DUO" ? (
                <Ligne2
                  cle="Binôme"
                  valeur={
                    [fiche.partnerFirstName, fiche.partnerLastName]
                      .filter(Boolean)
                      .join(" ") || "—"
                  }
                />
              ) : null}
              {fiche.plan === "DUO" ? (
                <Ligne2 cle="Tél. binôme" valeur={fiche.partnerPhone ?? "—"} />
              ) : null}
              <Ligne2 cle="Inscrit le" valeur={date(fiche.createdAt)} />
            </dl>
          </Cadre>
        </aside>
      </div>
    </>
  );
}

/**
 * L'inscription n'existe pas.
 *
 * Rendu ici plutôt que par `notFound()` : sous `cacheComponents`, un
 * `notFound()` levé dans un composant dynamique part dans le flux RSC et
 * c'est le navigateur qui l'exécute. Sans JavaScript, le visiteur reste
 * sur « Chargement… ». Mesuré le 2026-11-02. Ce bloc-ci arrive comme du
 * contenu ordinaire, donc il s'affiche toujours.
 */
function Introuvable() {
  return (
    <>
      <Link
        href="/admin/inscriptions"
        className="font-mono text-small text-fg/50"
      >
        ← Toutes les inscriptions
      </Link>
      <div className="mt-4">
        <Surtitre>Introuvable</Surtitre>
        <TitrePage>Cette inscription n&apos;existe pas.</TitrePage>
        <p className="mt-3 max-w-[46ch] text-body text-fg/60">
          L&apos;identifiant demandé ne correspond à aucune inscription.
          Elle a peut-être été créée sur un autre environnement.
        </p>
      </div>
    </>
  );
}

function Ligne2({
  cle,
  valeur,
  accent,
}: {
  cle: string;
  valeur: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="font-mono text-small uppercase tracking-[0.15em] text-fg/45">
        {cle}
      </dt>
      <dd
        className={`font-mono text-small ${accent ? "text-accent" : "text-fg/85"}`}
      >
        {valeur}
      </dd>
    </div>
  );
}

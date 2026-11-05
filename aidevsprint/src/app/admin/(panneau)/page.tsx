import { Suspense } from "react";
import Link from "next/link";

import {
  exigeSession,
  resume,
  sessionPerdue,
  traduitAdmin,
} from "@/lib/admin/api";
import {
  date,
  montant,
  nomEtudiant,
  type Paiement,
  type Inscription,
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
  Tuile,
  Vide,
} from "@/components/admin/Briques";
import { redirect } from "next/navigation";

/**
 * `/admin` — le tableau de bord.
 *
 * Une seule requête, `GET /admin/dashboard/summary`, qui porte déjà les
 * agrégats et les dix derniers de chaque liste. Inutile d'en faire trois.
 *
 * ── Pourquoi un `Suspense` ───────────────────────────────────────────
 * `cacheComponents` est actif dans ce projet. Tout ce qui lit le cookie de
 * session est donc dynamique, et Next exige une frontière au-dessus pour
 * pouvoir servir la coquille sans attendre l'API.
 */

export default function PageTableauDeBord() {
  return (
    <Suspense fallback={<Attente />}>
      <Contenu />
    </Suspense>
  );
}

function Attente() {
  return (
    <>
      <Surtitre>Vue d&apos;ensemble</Surtitre>
      <TitrePage>Tableau de bord</TitrePage>
      <p className="mt-6 font-mono text-small text-fg/45">Chargement…</p>
    </>
  );
}

async function Contenu() {
  await exigeSession();

  let donnees;
  try {
    donnees = await resume();
  } catch (cause) {
    // Jeton expiré pendant la navigation : on repart proprement à la
    // connexion plutôt que d'afficher une erreur qu'on sait résoudre.
    if (sessionPerdue(cause)) redirect("/admin/connexion");
    return (
      <>
        <Surtitre>Vue d&apos;ensemble</Surtitre>
        <TitrePage>Tableau de bord</TitrePage>
        <div className="mt-6">
          <Alerte>{traduitAdmin(cause)}</Alerte>
        </div>
      </>
    );
  }

  return (
    <>
      <Surtitre>Vue d&apos;ensemble</Surtitre>
      <TitrePage>Tableau de bord</TitrePage>

      <div
        className="mt-[clamp(1.5rem,4svh,2.5rem)] grid gap-[clamp(0.75rem,2vw,1.25rem)]
                   [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]"
      >
        <Tuile
          libelle="Encaissé"
          valeur={montant(donnees.totalCollectedXof)}
          precision="paiements réussis uniquement"
        />
        <Tuile
          libelle="Reste à encaisser"
          valeur={montant(donnees.totalOutstandingXof)}
          precision="inscriptions non annulées"
        />
        <Tuile
          libelle="Inscriptions"
          valeur={String(donnees.totalEnrollments)}
          precision="hors annulées"
        />
        <Tuile
          libelle="Participants"
          valeur={String(donnees.totalStudents)}
        />
        <Tuile
          libelle="Sessions actives"
          valeur={String(donnees.activeSprints)}
        />
        <Tuile
          libelle="Paiements en attente"
          valeur={String(donnees.pendingPayments?.count ?? 0)}
          precision={montant(donnees.pendingPayments?.amountXof)}
        />
      </div>

      <div className="mt-[clamp(1.5rem,4svh,2.5rem)] flex flex-col gap-[clamp(1rem,3svh,2rem)]">
        <Cadre
          titre="Dernières inscriptions"
          action={
            <Link
              href="/admin/inscriptions"
              className="font-mono text-small text-accent"
            >
              Tout voir →
            </Link>
          }
        >
          {donnees.recentEnrollments?.length ? (
            <Tableau entetes={["Participant", "Session", "Statut", "Reste", "Date"]}>
              {donnees.recentEnrollments.map((i: Inscription) => (
                <Ligne key={i.id}>
                  <Cellule>
                    <Link
                      href={`/admin/inscriptions/${i.id}`}
                      className="text-fg underline decoration-fg/25 underline-offset-4"
                    >
                      {nomEtudiant(i.student)}
                    </Link>
                  </Cellule>
                  <Cellule sourd>{i.sprint?.name ?? "—"}</Cellule>
                  <Cellule>
                    <PastilleInscription statut={i.status} />
                  </Cellule>
                  <Cellule mono>{montant(i.remainingAmountXof)}</Cellule>
                  <Cellule mono sourd>
                    {date(i.createdAt)}
                  </Cellule>
                </Ligne>
              ))}
            </Tableau>
          ) : (
            <Vide>Aucune inscription pour l&apos;instant.</Vide>
          )}
        </Cadre>

        <Cadre
          titre="Derniers paiements"
          action={
            <Link
              href="/admin/paiements"
              className="font-mono text-small text-accent"
            >
              Tout voir →
            </Link>
          }
        >
          {donnees.recentPayments?.length ? (
            <Tableau entetes={["Référence", "Montant", "Statut", "Participant", "Payé le"]}>
              {donnees.recentPayments.map((p: Paiement) => (
                <Ligne key={p.id}>
                  <Cellule mono>
                    <span className="select-all">{p.reference}</span>
                  </Cellule>
                  <Cellule mono>{montant(p.amountXof)}</Cellule>
                  <Cellule>
                    <PastillePaiement statut={p.status} />
                  </Cellule>
                  <Cellule sourd>
                    {nomEtudiant(p.enrollment?.student)}
                  </Cellule>
                  <Cellule mono sourd>
                    {date(p.paidAt)}
                  </Cellule>
                </Ligne>
              ))}
            </Tableau>
          ) : (
            <Vide>Aucun paiement pour l&apos;instant.</Vide>
          )}
        </Cadre>
      </div>
    </>
  );
}

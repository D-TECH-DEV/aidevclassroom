import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Clock01Icon,
  CreditCardIcon,
  Rocket01Icon,
  UserGroupIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";

import {
  exigeSession,
  resume,
  sessionPerdue,
  traduitAdmin,
} from "@/lib/admin/api";
import { montant } from "@/lib/admin/types";
import {
  Alerte,
  EnTetePage,
  Surtitre,
  TitrePage,
  Tuile,
} from "@/components/admin/Briques";
import { TableauActiviteRecente } from "@/components/admin/TableauActiviteRecente";

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
      <EnTetePage
        surtitre="Vue d'ensemble"
        titre="Tableau de bord"
        description="Activité globale des inscriptions, encaissements et sessions actives."
        action={
          <Link
            href="/admin/sprints"
            className="inline-flex items-center gap-2 rounded-field border
                       border-fg/20 bg-surface px-4 py-2 font-mono text-small
                       text-fg/85 transition-colors hover:border-accent/50 hover:text-fg"
          >
            <HugeiconsIcon icon={Rocket01Icon} size={15} className="text-accent" />
            <span>Gérer les sprints</span>
          </Link>
        }
      />

      <div className="mt-[clamp(1.5rem,4svh,2.5rem)] grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tuile
          libelle="Encaissé"
          valeur={montant(donnees.totalCollectedXof)}
          precision="paiements réussis uniquement"
          icone={<HugeiconsIcon icon={Wallet01Icon} size={16} />}
          accent
        />
        <Tuile
          libelle="Reste à encaisser"
          valeur={montant(donnees.totalOutstandingXof)}
          precision="inscriptions non annulées"
          icone={<HugeiconsIcon icon={CreditCardIcon} size={16} />}
        />
        <Tuile
          libelle="Inscriptions"
          valeur={String(donnees.totalEnrollments)}
          precision="hors annulées"
          icone={<HugeiconsIcon icon={UserGroupIcon} size={16} />}
        />
        <Tuile
          libelle="Participants"
          valeur={String(donnees.totalStudents)}
          icone={<HugeiconsIcon icon={UserGroupIcon} size={16} />}
        />
        <Tuile
          libelle="Sessions actives"
          valeur={String(donnees.activeSprints)}
          icone={<HugeiconsIcon icon={Rocket01Icon} size={16} />}
        />
        <Tuile
          libelle="Paiements en attente"
          valeur={String(donnees.pendingPayments?.count ?? 0)}
          precision={montant(donnees.pendingPayments?.amountXof)}
          icone={<HugeiconsIcon icon={Clock01Icon} size={16} />}
        />
      </div>

      <div className="mt-[clamp(1.5rem,4svh,2.5rem)]">
        <TableauActiviteRecente
          inscriptions={donnees.recentEnrollments ?? []}
          paiements={donnees.recentPayments ?? []}
        />
      </div>
    </>
  );
}

import type { Metadata } from "next";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BoutonRetourHaut } from "@/components/layout/BoutonRetourHaut";
import { Hero } from "@/components/hero/Hero";
import { Probleme } from "@/components/sections/Probleme";
import { Methode } from "@/components/sections/Methode";
import { Parcours } from "@/components/sections/Parcours";
import { Session } from "@/components/sections/Session";
import { Formateurs } from "@/components/sections/Formateurs";
import { Faq } from "@/components/sections/Faq";
import { ModaleInscription } from "@/components/inscription/ModaleInscription";
import { ModaleReprendrePaiement } from "@/components/paiement/ModaleReprendrePaiement";
import { CtaFinal } from "@/components/sections/CtaFinal";
import { recupereContenuSite } from "@/lib/contenu";
import { recupereSprints } from "@/lib/edition";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const sprints = await recupereSprints();
  const edition = sprints.find((sprint) => sprint.statut === "ACTIVE") ?? null;
  if (!edition) return {};
  return {
    title: `${edition.nom} — AIDevClassroom`,
    description:
      edition.description ??
      "Un sprint pour coder un vrai produit web avec l'IA et repartir avec son portfolio déployé en ligne.",
  };
}

/**
 * L'ordre des sections suit le design de la vitrine : le problème, la méthode,
 * le parcours, la session, les formateurs, la FAQ, la relance finale.
 *
 * L'édition et les contenus éditoriaux viennent de l'API. Chaque section
 * sait se montrer proprement sans données actives plutôt que d'afficher de
 * fausses valeurs.
 */
export default async function Page() {
  const [sprints, contenu] = await Promise.all([
    recupereSprints(),
    recupereContenuSite(),
  ]);
  const edition = sprints.find((sprint) => sprint.statut === "ACTIVE") ?? null;

  return (
    <ModaleInscription
      editions={sprints.filter((sprint) => sprint.statut === "ACTIVE")}
      whatsappAffiche={contenu.whatsappDisplay}
      whatsappLien={contenu.whatsappHref}
    >
      <ModaleReprendrePaiement>
        <Navbar
          sprintId={edition?.id ?? null}
          inscrits={edition?.inscrits ?? null}
          quota={edition?.quota ?? null}
        />
        <main id="top" className="flex-1">
          <Hero edition={edition} />
          <Probleme />
          <Methode />
          <Parcours sprints={sprints} />
          <Session
            edition={edition}
            whatsappAffiche={contenu.whatsappDisplay}
            whatsappLien={contenu.whatsappHref}
          />
          <Formateurs formateurs={contenu.trainers} />
          <Faq questions={contenu.faqs} />
          <CtaFinal />
        </main>
        <Footer contactEmail={contenu.contactEmail} />
        <BoutonRetourHaut />
      </ModaleReprendrePaiement>
    </ModaleInscription>
  );
}

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/hero/Hero";
import { Probleme } from "@/components/sections/Probleme";
import { Methode } from "@/components/sections/Methode";
import { Parcours } from "@/components/sections/Parcours";
import { Session } from "@/components/sections/Session";
import { Formateurs } from "@/components/sections/Formateurs";
import { Faq } from "@/components/sections/Faq";
import { ModaleInscription } from "@/components/inscription/ModaleInscription";
import { CtaFinal } from "@/components/sections/CtaFinal";
import { recupereSprints } from "@/lib/edition";

/**
 * L'ordre des sections suit le design
 * `Landing — ai-dev-sprint.com@2x.png` : le problème, la méthode, le
 * parcours, la session, les formateurs, la FAQ, la relance finale.
 *
 * Le formulaire d'inscription n'est pas une section : c'est une modale,
 * ouverte par n'importe quel « Réserver ma place ». Elle enveloppe toute
 * la page parce que la navbar aussi porte un de ces boutons.
 *
 * L'édition vient de l'API (voir `src/lib/edition.ts`). Elle peut être
 * `null` — aucun sprint publié, ou serveur injoignable — et chaque section
 * sait se montrer sans elle plutôt que d'afficher d'anciennes valeurs.
 */
export default async function Page() {
  // Une seule lecture du catalogue : le hero et la session gardent
  // la session ouverte la plus récente, le parcours liste tout, et la
  // modale ne propose que les sessions où l'on peut s'inscrire.
  const sprints = await recupereSprints();
  const edition = sprints.find((sprint) => sprint.statut === "ACTIVE") ?? null;

  return (
    <ModaleInscription
      editions={sprints.filter((sprint) => sprint.statut === "ACTIVE")}
    >
      <Navbar
        inscrits={edition?.inscrits ?? null}
        quota={edition?.quota ?? null}
      />
      <main id="top" className="flex-1">
        <Hero edition={edition} />
        <Probleme />
        <Methode />
        <Parcours sprints={sprints} />
        <Session edition={edition} />
        <Formateurs />
        <Faq />
        <CtaFinal />
      </main>
      <Footer />
    </ModaleInscription>
  );
}

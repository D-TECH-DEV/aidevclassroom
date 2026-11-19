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
import { A_DETERMINER, recupereSprints } from "@/lib/edition";
import { construitJsonLdAccueil, MOTS_CLES_SEO } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const sprints = await recupereSprints();
  const edition = sprints.find((sprint) => sprint.statut === "ACTIVE") ?? null;
  if (!edition) {
    return {
      alternates: { canonical: "/" },
    };
  }
  const ville =
    edition.ville && edition.ville !== A_DETERMINER
      ? edition.ville
      : "Yamoussoukro";
  const titre = `${edition.nom} à ${ville} — Formation Développement Web & IA`;
  const description =
    edition.description ??
    `Sprint intensif en présentiel à ${ville} (Côte d'Ivoire) pour concevoir, coder un vrai produit web avec l'IA, le sécuriser et le déployer en ligne.`;

  return {
    title: titre,
    description,
    keywords: [
      ...MOTS_CLES_SEO,
      edition.nom,
      `formation ${ville}`,
      ...edition.modules,
    ],
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title: `${edition.nom} — AIDevClassroom (${ville})`,
      description,
      url: "/",
      siteName: "AIDevClassroom",
      locale: "fr_CI",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${edition.nom} — AIDevClassroom (${ville})`,
      description,
    },
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
  const jsonLd = construitJsonLdAccueil({ sprints, edition, contenu });

  return (
    <ModaleInscription
      editions={sprints.filter((sprint) => sprint.statut === "ACTIVE")}
      whatsappAffiche={contenu.whatsappDisplay}
      whatsappLien={contenu.whatsappHref}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
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

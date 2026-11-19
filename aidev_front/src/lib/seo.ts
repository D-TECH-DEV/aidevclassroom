import { A_DETERMINER, type Edition } from "@/lib/edition";
import type { ContenuSite, FormateurPublic, QuestionFaq } from "@/lib/contenu";

const URL_DEFAUT = "https://ai-devclassroom.com";

export function recupereSiteUrl(): string {
  const brut = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!brut) return URL_DEFAUT;
  try {
    const parsed = new URL(brut);
    return parsed.origin;
  } catch {
    return URL_DEFAUT;
  }
}

export const MOTS_CLES_SEO: string[] = [
  "AIDevClassroom",
  "AI Dev Classroom",
  "formation IA Côte d'Ivoire",
  "formation développeur Yamoussoukro",
  "formation développement web IA",
  "vibe coding méthodique",
  "coder avec l'IA",
  "bootcamp programmation Yamoussoukro",
  "formation Claude Code Cursor",
  "atelier développement web Afrique",
  "créer son portfolio développeur",
  "architecture logicielle IA",
  "sprint développement web intensif",
];

function construitSchemaFormateur(
  formateur: FormateurPublic,
  baseUrl: string,
): Record<string, unknown> {
  const nomComplet = [formateur.firstName, formateur.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const sameAs = [
    formateur.githubUrl,
    formateur.linkedinUrl,
    formateur.portfolioUrl,
  ].filter((lien): lien is string => Boolean(lien && lien.trim().length > 0));

  const schema: Record<string, unknown> = {
    "@type": "Person",
    name: nomComplet || formateur.firstName,
    jobTitle: formateur.role,
    worksFor: {
      "@id": `${baseUrl}/#organization`,
    },
  };

  if (formateur.bio?.trim()) {
    schema.description = formateur.bio.trim();
  }
  if (formateur.photoPath?.trim()) {
    schema.image = formateur.photoPath.startsWith("http")
      ? formateur.photoPath
      : `${baseUrl}${formateur.photoPath}`;
  }
  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
  }
  return schema;
}

function construitSchemaOffres(
  sprint: Edition,
  baseUrl: string,
): Record<string, unknown>[] {
  const placesRestantes =
    sprint.quota != null && sprint.inscrits != null
      ? Math.max(0, sprint.quota - sprint.inscrits)
      : null;
  const disponibilite =
    sprint.statut !== "ACTIVE"
      ? "https://schema.org/PreOrder"
      : placesRestantes === 0
        ? "https://schema.org/SoldOut"
        : "https://schema.org/InStock";

  const offres: Record<string, unknown>[] = [
    {
      "@type": "Offer",
      name: `Inscription Solo — ${sprint.nom}`,
      category: "Solo",
      price: sprint.prixFCFA,
      priceCurrency: "XOF",
      availability: disponibilite,
      url: `${baseUrl}/#session`,
      validFrom: sprint.dateDebut,
    },
  ];

  if (sprint.prixDuoFCFA != null && sprint.prixDuoFCFA > 0) {
    offres.push({
      "@type": "Offer",
      name: `Inscription Duo (2 personnes) — ${sprint.nom}`,
      category: "Duo",
      price: sprint.prixDuoFCFA,
      priceCurrency: "XOF",
      availability: disponibilite,
      url: `${baseUrl}/#session`,
      validFrom: sprint.dateDebut,
    });
  }

  return offres;
}

function construitSchemaSprint(
  sprint: Edition,
  formateurs: FormateurPublic[],
  baseUrl: string,
): Record<string, unknown> {
  const ville =
    sprint.ville && sprint.ville !== A_DETERMINER
      ? sprint.ville
      : "Yamoussoukro";
  const lieu =
    sprint.lieu && sprint.lieu !== A_DETERMINER
      ? sprint.lieu
      : "Yamoussoukro, Côte d'Ivoire";
  const offres = construitSchemaOffres(sprint, baseUrl);
  const instructeurs = formateurs.map((f) =>
    construitSchemaFormateur(f, baseUrl),
  );

  const instanceCours: Record<string, unknown> = {
    "@type": "CourseInstance",
    name: sprint.nom,
    courseMode: "Onsite",
    inLanguage: "fr",
    startDate: sprint.dateDebut,
    endDate: sprint.dateFin,
    location: {
      "@type": "Place",
      name: lieu,
      address: {
        "@type": "PostalAddress",
        addressLocality: ville,
        addressCountry: "CI",
      },
    },
  };

  if (instructeurs.length > 0) {
    instanceCours.instructor = instructeurs;
  }

  const schema: Record<string, unknown> = {
    "@type": "Course",
    "@id": `${baseUrl}/#course-${sprint.id}`,
    name: sprint.nom,
    description:
      sprint.description ??
      "Formation présentielle intensive en développement logiciel assisté par l'IA, architecture propre, sécurité et déploiement en production.",
    provider: {
      "@id": `${baseUrl}/#organization`,
    },
    inLanguage: "fr",
    educationalLevel:
      sprint.niveau && sprint.niveau !== A_DETERMINER
        ? sprint.niveau
        : "Bases en développement",
    teaches:
      sprint.modules.length > 0
        ? sprint.modules
        : [
            "Conception et design web",
            "Développement assisté par IA avec contexte structuré",
            "Revue de code et sécurité applicative",
            "Déploiement en ligne d'un projet complet",
          ],
    offers: offres,
    hasCourseInstance: [instanceCours],
  };

  if (sprint.quota != null) {
    schema.totalHistoricalEnrollment = sprint.inscrits ?? 0;
  }

  return schema;
}

function construitSchemaEvenement(
  edition: Edition,
  formateurs: FormateurPublic[],
  baseUrl: string,
): Record<string, unknown> {
  const ville =
    edition.ville && edition.ville !== A_DETERMINER
      ? edition.ville
      : "Yamoussoukro";
  const lieu =
    edition.lieu && edition.lieu !== A_DETERMINER
      ? edition.lieu
      : "Yamoussoukro, Côte d'Ivoire";

  const schema: Record<string, unknown> = {
    "@type": "EducationEvent",
    "@id": `${baseUrl}/#event-${edition.id}`,
    name: `${edition.nom} — AIDevClassroom`,
    description:
      edition.description ??
      "Sprint intensif en présentiel : concevoir, coder avec l'IA selon une méthode rigoureuse, sécuriser et déployer son application web en ligne.",
    startDate: edition.dateDebut,
    endDate: edition.dateFin,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    inLanguage: "fr",
    isAccessibleForFree: false,
    organizer: {
      "@id": `${baseUrl}/#organization`,
    },
    location: {
      "@type": "Place",
      name: lieu,
      address: {
        "@type": "PostalAddress",
        addressLocality: ville,
        addressCountry: "CI",
      },
    },
    offers: construitSchemaOffres(edition, baseUrl),
    image: [`${baseUrl}/opengraph-image`],
  };

  if (edition.quota != null) {
    schema.maximumAttendeeCapacity = edition.quota;
    if (edition.inscrits != null) {
      schema.remainingAttendeeCapacity = Math.max(
        0,
        edition.quota - edition.inscrits,
      );
    }
  }

  if (formateurs.length > 0) {
    schema.performer = formateurs.map((f) =>
      construitSchemaFormateur(f, baseUrl),
    );
  }

  return schema;
}

function construitSchemaFaq(
  faqs: QuestionFaq[],
  baseUrl: string,
): Record<string, unknown> | null {
  const questionsValides = faqs.filter(
    (q) =>
      q.question.trim().length > 0 &&
      Boolean(q.answer && q.answer.trim().length > 0),
  );
  if (questionsValides.length === 0) return null;

  return {
    "@type": "FAQPage",
    "@id": `${baseUrl}/#faq`,
    mainEntity: questionsValides.map((q) => ({
      "@type": "Question",
      name: q.question.trim(),
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer!.trim(),
      },
    })),
  };
}

/**
 * Construit le graphe JSON-LD Schema.org complet à partir des données
 * réelles de l'API (sprints, formateurs, FAQ, contact).
 */
export function construitJsonLdAccueil({
  sprints,
  edition,
  contenu,
}: {
  sprints: Edition[];
  edition: Edition | null;
  contenu: ContenuSite;
}): Record<string, unknown> {
  const baseUrl = recupereSiteUrl();

  const organisation: Record<string, unknown> = {
    "@type": "EducationalOrganization",
    "@id": `${baseUrl}/#organization`,
    name: "AIDevClassroom",
    alternateName: "AI Dev Classroom",
    url: baseUrl,
    logo: {
      "@type": "ImageObject",
      url: `${baseUrl}/logo/aidevclassroom-icon.png`,
    },
    description:
      "Programme de formation intensive par sprints en Côte d'Ivoire pour maîtriser le développement logiciel assisté par l'intelligence artificielle, la sécurité du code et la mise en production.",
    areaServed: {
      "@type": "Country",
      name: "Côte d'Ivoire",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: edition?.ville && edition.ville !== A_DETERMINER ? edition.ville : "Yamoussoukro",
      addressCountry: "CI",
    },
    knowsAbout: [
      "Développement Web Full-Stack",
      "Ingénierie assistée par Intelligence Artificielle",
      "Architecture logicielle et Clean Code",
      "Sécurité des applications web",
      "Déploiement cloud et mise en production",
    ],
  };

  const contactPoints: Record<string, unknown>[] = [];
  if (contenu.contactEmail) {
    organisation.email = contenu.contactEmail;
    contactPoints.push({
      "@type": "ContactPoint",
      contactType: "customer support",
      email: contenu.contactEmail,
      availableLanguage: ["fr"],
    });
  }
  if (contenu.whatsappHref) {
    contactPoints.push({
      "@type": "ContactPoint",
      contactType: "reservations",
      url: contenu.whatsappHref,
      telephone: contenu.whatsappDisplay,
      availableLanguage: ["fr"],
    });
  }
  if (contactPoints.length > 0) {
    organisation.contactPoint = contactPoints;
  }

  const siteWeb: Record<string, unknown> = {
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    url: baseUrl,
    name: "AIDevClassroom",
    inLanguage: "fr-CI",
    publisher: {
      "@id": `${baseUrl}/#organization`,
    },
  };

  const pageWeb: Record<string, unknown> = {
    "@type": "WebPage",
    "@id": `${baseUrl}/#webpage`,
    url: baseUrl,
    name: edition
      ? `${edition.nom} — AIDevClassroom (${edition.ville !== A_DETERMINER ? edition.ville : "Yamoussoukro"})`
      : "AIDevClassroom — Formation Développement Web & IA en Côte d'Ivoire",
    description:
      edition?.description ??
      "Formation intensive en présentiel à Yamoussoukro : apprendre à guider l'IA avec une méthode d'ingénierie logicielle et déployer son application web en ligne.",
    inLanguage: "fr-CI",
    isPartOf: {
      "@id": `${baseUrl}/#website`,
    },
    about: {
      "@id": `${baseUrl}/#organization`,
    },
  };

  const graph: Record<string, unknown>[] = [organisation, siteWeb, pageWeb];

  for (const sprint of sprints) {
    graph.push(construitSchemaSprint(sprint, contenu.trainers, baseUrl));
  }

  if (edition) {
    graph.push(construitSchemaEvenement(edition, contenu.trainers, baseUrl));
  }

  const schemaFaq = construitSchemaFaq(contenu.faqs, baseUrl);
  if (schemaFaq) {
    graph.push(schemaFaq);
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

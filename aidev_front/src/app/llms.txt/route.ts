import { NextResponse } from "next/server";

import { recupereContenuSite } from "@/lib/contenu";
import { A_DETERMINER, recupereSprints } from "@/lib/edition";
import { recupereSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const [sprints, contenu] = await Promise.all([
    recupereSprints(),
    recupereContenuSite(),
  ]);
  const baseUrl = recupereSiteUrl();
  const edition = sprints.find((s) => s.statut === "ACTIVE") ?? null;

  const lignes: string[] = [
    "# AIDevClassroom",
    "",
    "> Programme de formation intensive par sprints présentiels en Côte d'Ivoire (Yamoussoukro) pour apprendre à concevoir, développer, sécuriser et déployer des applications web réelles en guidant l'intelligence artificielle avec une méthodologie d'ingénierie logicielle stricte.",
    "",
    `- Site officiel : ${baseUrl}`,
    `- Contact WhatsApp : ${contenu.whatsappDisplay} (${contenu.whatsappHref})`,
  ];

  if (contenu.contactEmail) {
    lignes.push(`- E-mail : ${contenu.contactEmail}`);
  }

  lignes.push(
    "",
    "## Méthodologie enseignée (4 piliers)",
    "1. **Le contexte (.md)** : structurer des fichiers de spécifications, d'architecture et de conventions pour aligner l'IA sur les standards du projet.",
    "2. **Les skills ({ })** : utiliser des briques de savoir-faire réutilisables (design system, API, sécurité, déploiement).",
    "3. **Les bons prompts (>_)** : découper les fonctionnalités, spécifier les contraintes et itérer étape par étape.",
    "4. **Revue & sécurité (</>)** : auditer le code généré, corriger les failles de sécurité et valider avant la mise en production.",
  );

  if (edition) {
    const dateDebut = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(edition.dateDebut));
    const ville =
      edition.ville !== A_DETERMINER ? edition.ville : "Yamoussoukro";
    const lieu =
      edition.lieu !== A_DETERMINER
        ? `${ville} (${edition.lieu})`
        : ville;

    lignes.push(
      "",
      `## Session ouverte aux inscriptions : ${edition.nom}`,
      `- Date : ${dateDebut}`,
      `- Format : ${edition.format}`,
      `- Lieu : ${lieu}, Côte d'Ivoire`,
      `- Niveau requis : ${edition.niveau !== A_DETERMINER ? edition.niveau : "Bases en développement"}`,
      `- Tarif Solo : ${edition.prixFCFA.toLocaleString("fr-FR")} FCFA (acompte minimum : ${edition.minimumFCFA.toLocaleString("fr-FR")} FCFA)`,
    );

    if (edition.prixDuoFCFA != null) {
      lignes.push(
        `- Tarif Duo (2 places) : ${edition.prixDuoFCFA.toLocaleString("fr-FR")} FCFA`,
      );
    }
    if (edition.quota != null) {
      lignes.push(`- Capacité : ${edition.quota} places`);
    }
    if (edition.description) {
      lignes.push(`- Résumé : ${edition.description}`);
    }
    if (edition.modules.length > 0) {
      lignes.push("- Programme du sprint :");
      edition.modules.forEach((mod, index) => {
        lignes.push(`  ${index + 1}. ${mod}`);
      });
    }
  }

  if (sprints.length > 0) {
    lignes.push("", "## Catalogue des Sprints");
    for (const s of sprints) {
      const statut =
        s.statut === "ACTIVE" ? "Inscriptions ouvertes" : "Prochainement";
      lignes.push(
        `- **${s.nom}** (${statut}) — ${s.prixFCFA.toLocaleString("fr-FR")} FCFA : ${s.description ?? "Sprint pratique en présentiel."}`,
      );
    }
  }

  if (contenu.trainers.length > 0) {
    lignes.push("", "## Formateurs");
    for (const f of contenu.trainers) {
      const nom = [f.firstName, f.lastName].filter(Boolean).join(" ");
      const bio = f.bio ? ` — ${f.bio}` : "";
      lignes.push(`- **${nom}** (${f.role})${bio}`);
    }
  }

  const faqsValides = contenu.faqs.filter(
    (q) => q.question.trim() && q.answer?.trim(),
  );
  if (faqsValides.length > 0) {
    lignes.push("", "## Questions fréquentes (FAQ)");
    for (const q of faqsValides) {
      lignes.push(`### ${q.question.trim()}`, q.answer!.trim(), "");
    }
  }

  return new NextResponse(lignes.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}

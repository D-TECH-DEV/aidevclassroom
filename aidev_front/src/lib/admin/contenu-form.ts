import type { ContenuSiteAdmin } from "@/lib/admin/types";

function estUrlHttps(valeur: string): boolean {
  try {
    return new URL(valeur).protocol === "https:";
  } catch {
    return false;
  }
}

export function parseContenuSitePayload(
  rawJson: string,
): { payload: ContenuSiteAdmin } | { erreur: string } {
  let brut: ContenuSiteAdmin;
  try {
    brut = JSON.parse(rawJson) as ContenuSiteAdmin;
  } catch {
    return { erreur: "Données du formulaire illisibles." };
  }

  const whatsappDisplay = String(brut.whatsappDisplay ?? "").trim();
  const whatsappHref = String(brut.whatsappHref ?? "").trim();
  const contactEmail = String(brut.contactEmail ?? "").trim() || null;
  if (!whatsappDisplay || whatsappDisplay.length > 30) {
    return {
      erreur: "Le numéro WhatsApp affiché est requis (30 caractères max).",
    };
  }
  if (!estUrlHttps(whatsappHref)) {
    return {
      erreur:
        "Le lien WhatsApp doit être une URL HTTPS valide (ex. https://wa.me/225...).",
    };
  }
  if (
    contactEmail &&
    (contactEmail.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
  ) {
    return {
      erreur: "L'adresse e-mail de contact est invalide (180 caractères max).",
    };
  }

  const trainers = Array.isArray(brut.trainers) ? brut.trainers : [];
  for (let i = 0; i < trainers.length; i += 1) {
    const t = trainers[i];
    if (!t.firstName?.trim() || !t.role?.trim()) {
      return {
        erreur: `Formateur #${i + 1} : prénom et rôle sont obligatoires.`,
      };
    }
    for (const [nomChamp, url] of [
      ["GitHub", t.githubUrl],
      ["LinkedIn", t.linkedinUrl],
      ["Portfolio", t.portfolioUrl],
    ] as const) {
      const propre = url?.trim();
      if (propre && !estUrlHttps(propre)) {
        return {
          erreur: `Formateur ${t.firstName.trim()} : le lien ${nomChamp} doit commencer par https://.`,
        };
      }
    }
  }

  const faqs = Array.isArray(brut.faqs) ? brut.faqs : [];
  for (let i = 0; i < faqs.length; i += 1) {
    if (!faqs[i].question?.trim()) {
      return { erreur: `Question FAQ #${i + 1} : l'intitulé est requis.` };
    }
  }

  return {
    payload: {
      whatsappDisplay,
      whatsappHref,
      contactEmail,
      trainers: trainers.map((t, index) => ({
        ...(t.id ? { id: t.id } : {}),
        firstName: t.firstName.trim(),
        lastName: t.lastName?.trim() || null,
        role: t.role.trim(),
        photoPath: t.photoPath?.trim() || null,
        badgePath: t.badgePath?.trim() || null,
        bio: t.bio?.trim() ?? "",
        githubUrl: t.githubUrl?.trim() || null,
        linkedinUrl: t.linkedinUrl?.trim() || null,
        portfolioUrl: t.portfolioUrl?.trim() || null,
        sortOrder: index + 1,
      })),
      faqs: faqs.map((f, index) => ({
        ...(f.id ? { id: f.id } : {}),
        question: f.question.trim(),
        answer: f.answer?.trim() ?? "",
        sortOrder: index + 1,
      })),
    },
  };
}

import { api } from "@/lib/api";

export type FormateurPublic = {
  id: number;
  firstName: string;
  lastName: string | null;
  role: string;
  photoPath: string | null;
  badgePath: string | null;
  bio: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  sortOrder: number;
};

export type QuestionFaq = {
  id: number;
  question: string;
  answer: string | null;
  sortOrder: number;
};

export type ContenuSite = {
  whatsappDisplay: string;
  whatsappHref: string;
  contactEmail: string | null;
  trainers: FormateurPublic[];
  faqs: QuestionFaq[];
};

const REVALIDATION_SECONDES = 0;

export const CONTENU_SITE_VIDE: ContenuSite = {
  whatsappDisplay: "07 04 92 10 80",
  whatsappHref: "https://wa.me/2250704921080",
  contactEmail: "contact@aidevclassroom.com",
  trainers: [],
  faqs: [],
};

/**
 * Lit le contenu editorial global (WhatsApp, formateurs, FAQ) depuis l'API.
 * Un echec reseau ou build hors ligne ne casse pas la vitrine.
 */
export async function recupereContenuSite(): Promise<ContenuSite> {
  try {
    const data = await api<ContenuSite>("/site-content", {
      revalider: REVALIDATION_SECONDES,
    });
    return {
      whatsappDisplay:
        data.whatsappDisplay?.trim() || CONTENU_SITE_VIDE.whatsappDisplay,
      whatsappHref:
        data.whatsappHref?.trim() || CONTENU_SITE_VIDE.whatsappHref,
      contactEmail:
        data.contactEmail?.trim() || CONTENU_SITE_VIDE.contactEmail,
      trainers: Array.isArray(data.trainers) ? data.trainers : [],
      faqs: Array.isArray(data.faqs) ? data.faqs : [],
    };
  } catch {
    return CONTENU_SITE_VIDE;
  }
}

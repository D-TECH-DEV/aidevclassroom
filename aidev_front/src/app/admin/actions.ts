"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { api } from "@/lib/api";
import { fermeSession, ouvreSession } from "@/lib/admin/session";
import {
  changeStatut,
  changeStatutSprint,
  creerSprint,
  modifierContenuSite,
  modifierSprint,
  reverifie,
  supprimerSprint,
  traduitAdmin,
  type SprintModifie,
} from "@/lib/admin/api";
import type {
  Connexion,
  ContenuSiteAdmin,
  StatutInscription,
  StatutSprint,
} from "@/lib/admin/types";

/**
 * Les actions du panneau d'administration.
 *
 * Toutes tournent sur le serveur. Le JWT n'apparaît à aucun moment dans
 * une réponse envoyée au navigateur : il part directement du serveur Next
 * vers un cookie `httpOnly`.
 *
 * Chacune renvoie `{ erreur }` plutôt que de lever : un formulaire doit
 * pouvoir afficher ce qui s'est mal passé sans faire tomber la page.
 */

export type Etat = { erreur?: string };

export async function connexion(
  _precedent: Etat,
  donnees: FormData,
): Promise<Etat> {
  const email = String(donnees.get("email") ?? "")
    .trim()
    .toLowerCase();
  const motDePasse = String(donnees.get("motDePasse") ?? "");

  if (!email || !motDePasse) {
    return { erreur: "E-mail et mot de passe sont tous les deux requis." };
  }

  try {
    // Route publique : pas de jeton à présenter, et surtout pas de cache.
    const session = await api<Connexion>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: motDePasse }),
      cache: "no-store",
    });

    if (session.admin?.role !== "ADMIN") {
      return { erreur: "Ce compte n'a pas le rôle ADMIN." };
    }

    await ouvreSession(session.accessToken, session.expiresIn);
  } catch (cause) {
    return { erreur: traduitAdmin(cause) };
  }

  // `redirect` lève pour interrompre le rendu : il ne doit jamais se
  // trouver dans un `try`, sinon le `catch` l'avalerait comme une erreur.
  redirect("/admin");
}

export async function deconnexion() {
  await fermeSession();
  redirect("/admin/connexion");
}

export async function changeStatutInscription(
  _precedent: Etat,
  donnees: FormData,
): Promise<Etat> {
  const id = Number(donnees.get("id"));
  const statut = String(donnees.get("statut") ?? "") as StatutInscription;

  if (!Number.isInteger(id) || id <= 0) {
    return { erreur: "Inscription introuvable." };
  }

  try {
    await changeStatut(id, statut);
  } catch (cause) {
    return { erreur: traduitAdmin(cause) };
  }

  revalidatePath(`/admin/inscriptions/${id}`);
  revalidatePath("/admin/inscriptions");
  revalidatePath("/admin");
  return {};
}

const SLUG_OK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function versIso(valeur: string): string | null {
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function litPrixDuo(donnees: FormData):
  | { duoPriceXof: number | null; duoMinimumPaymentXof: number | null }
  | { erreur: string } {
  const brutPrixDuo = String(donnees.get("prixDuo") ?? "").trim();
  const brutMinimumDuo = String(donnees.get("minimumDuo") ?? "").trim();
  if (!brutPrixDuo && !brutMinimumDuo) {
    return { duoPriceXof: null, duoMinimumPaymentXof: null };
  }
  if (!brutPrixDuo) {
    return { erreur: "Le prix duo est requis quand un minimum duo est saisi." };
  }
  const duoPriceXof = Number(brutPrixDuo);
  if (!Number.isInteger(duoPriceXof) || duoPriceXof <= 0) {
    return { erreur: "Le prix duo doit être un entier positif en FCFA." };
  }
  let duoMinimumPaymentXof: number | null = null;
  if (brutMinimumDuo) {
    duoMinimumPaymentXof = Number(brutMinimumDuo);
    if (!Number.isInteger(duoMinimumPaymentXof) || duoMinimumPaymentXof < 1) {
      return { erreur: "Le minimum duo doit être au moins 1 FCFA." };
    }
    if (duoMinimumPaymentXof > duoPriceXof) {
      return {
        erreur: "Le minimum duo ne peut pas dépasser le prix duo.",
      };
    }
  }
  return { duoPriceXof, duoMinimumPaymentXof };
}

type OrganisationSprint = {
  city: string | null;
  location: string | null;
  format: string | null;
  level: string | null;
  modules: string[];
};

function litOrganisationSprint(
  donnees: FormData,
): OrganisationSprint | { erreur: string } {
  const city = String(donnees.get("ville") ?? "").trim() || null;
  const location = String(donnees.get("lieu") ?? "").trim() || null;
  const format = String(donnees.get("format") ?? "").trim() || null;
  const level = String(donnees.get("niveau") ?? "").trim() || null;
  const brutModules = String(donnees.get("modules") ?? "");
  const modules = brutModules
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0);

  if (city && city.length > 100) {
    return { erreur: "La ville ne doit pas dépasser 100 caractères." };
  }
  if (location && location.length > 255) {
    return { erreur: "Le lieu ne doit pas dépasser 255 caractères." };
  }
  if (format && format.length > 120) {
    return { erreur: "Le format ne doit pas dépasser 120 caractères." };
  }
  if (level && level.length > 120) {
    return { erreur: "Le niveau ne doit pas dépasser 120 caractères." };
  }
  if (modules.length > 8) {
    return { erreur: "Maximum 8 étapes dans le programme." };
  }
  if (modules.some((m) => m.length > 160)) {
    return {
      erreur: "Chaque étape du programme ne doit pas dépasser 160 caractères.",
    };
  }

  return { city, location, format, level, modules };
}

export async function creerNouveauSprint(
  _precedent: Etat,
  donnees: FormData,
): Promise<Etat> {
  const name = String(donnees.get("nom") ?? "").trim();
  const slug = String(donnees.get("slug") ?? "").trim().toLowerCase();
  const description = String(donnees.get("description") ?? "").trim();
  const priceXof = Number(donnees.get("prix"));
  const minimumPaymentXof = Number(donnees.get("minimum"));
  const brutDebut = String(donnees.get("debut") ?? "");
  const brutFin = String(donnees.get("fin") ?? "");
  const brutCapacite = String(donnees.get("capacite") ?? "").trim();
  const lancer = donnees.get("lancer") === "oui";

  if (!name) return { erreur: "Le nom du sprint est requis." };
  if (!SLUG_OK.test(slug)) {
    return {
      erreur:
        "Slug invalide : lettres minuscules, chiffres et tirets uniquement.",
    };
  }
  if (!Number.isInteger(priceXof) || priceXof <= 0) {
    return { erreur: "Le prix doit être un entier positif en FCFA." };
  }
  if (!Number.isInteger(minimumPaymentXof) || minimumPaymentXof < 1) {
    return { erreur: "Le versement minimum doit être au moins 1 FCFA." };
  }
  if (minimumPaymentXof > priceXof) {
    return {
      erreur: "Le versement minimum ne peut pas dépasser le prix.",
    };
  }

  const duo = litPrixDuo(donnees);
  if ("erreur" in duo) return { erreur: duo.erreur };

  const startAt = versIso(brutDebut);
  const endAt = versIso(brutFin);
  if (!startAt || !endAt) {
    return { erreur: "Les dates de début et de fin sont requises." };
  }
  if (new Date(startAt) >= new Date(endAt)) {
    return { erreur: "La date de fin doit être après la date de début." };
  }

  let capacity: number | null | undefined;
  if (brutCapacite) {
    const n = Number(brutCapacite);
    if (!Number.isInteger(n) || n < 1) {
      return { erreur: "La capacité doit être un entier positif." };
    }
    capacity = n;
  }

  const org = litOrganisationSprint(donnees);
  if ("erreur" in org) return { erreur: org.erreur };

  try {
    await creerSprint({
      name,
      slug,
      description: description || undefined,
      priceXof,
      minimumPaymentXof,
      duoPriceXof: duo.duoPriceXof,
      duoMinimumPaymentXof: duo.duoMinimumPaymentXof,
      startAt,
      endAt,
      capacity,
      city: org.city ?? undefined,
      location: org.location ?? undefined,
      format: org.format ?? undefined,
      level: org.level ?? undefined,
      modules: org.modules.length > 0 ? org.modules : undefined,
      status: lancer ? "ACTIVE" : "DRAFT",
    });
  } catch (cause) {
    return { erreur: traduitAdmin(cause) };
  }

  revalidatePath("/admin/sprints");
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin/sprints");
}

export async function modifierSprintExistant(
  _precedent: Etat,
  donnees: FormData,
): Promise<Etat> {
  const id = Number(donnees.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { erreur: "Sprint introuvable." };
  }
  const name = String(donnees.get("nom") ?? "").trim();
  const description = String(donnees.get("description") ?? "").trim();
  if (!name) return { erreur: "Le nom du sprint est requis." };

  const patch: SprintModifie = { name, description };
  const prix = String(donnees.get("prix") ?? "").trim();
  if (prix) {
    const priceXof = Number(prix);
    if (!Number.isInteger(priceXof) || priceXof <= 0) {
      return { erreur: "Le prix doit être un entier positif en FCFA." };
    }
    patch.priceXof = priceXof;
  }
  const minimum = String(donnees.get("minimum") ?? "").trim();
  if (minimum) {
    const minimumPaymentXof = Number(minimum);
    if (!Number.isInteger(minimumPaymentXof) || minimumPaymentXof < 1) {
      return { erreur: "Le versement minimum doit être au moins 1 FCFA." };
    }
    patch.minimumPaymentXof = minimumPaymentXof;
  }
  const duo = litPrixDuo(donnees);
  if ("erreur" in duo) return { erreur: duo.erreur };
  // Vide = on retire le forfait duo ; sinon on l'écrit.
  const veutDuo =
    String(donnees.get("prixDuo") ?? "").trim().length > 0 ||
    String(donnees.get("minimumDuo") ?? "").trim().length > 0;
  if (veutDuo) {
    patch.duoPriceXof = duo.duoPriceXof;
    patch.duoMinimumPaymentXof = duo.duoMinimumPaymentXof;
  } else if (donnees.get("retirerDuo") === "oui") {
    patch.duoPriceXof = null;
    patch.duoMinimumPaymentXof = null;
  }
  const debut = String(donnees.get("debut") ?? "").trim();
  if (debut) {
    const startAt = versIso(debut);
    if (!startAt) return { erreur: "Date de début invalide." };
    patch.startAt = startAt;
  }
  const fin = String(donnees.get("fin") ?? "").trim();
  if (fin) {
    const endAt = versIso(fin);
    if (!endAt) return { erreur: "Date de fin invalide." };
    patch.endAt = endAt;
  }
  const brutCapacite = String(donnees.get("capacite") ?? "").trim();
  if (brutCapacite) {
    const n = Number(brutCapacite);
    if (!Number.isInteger(n) || n < 1) {
      return { erreur: "La capacité doit être un entier positif." };
    }
    patch.capacity = n;
  }

  const org = litOrganisationSprint(donnees);
  if ("erreur" in org) return { erreur: org.erreur };
  patch.city = org.city;
  patch.location = org.location;
  patch.format = org.format;
  patch.level = org.level;
  patch.modules = org.modules;

  try {
    await modifierSprint(id, patch);
  } catch (cause) {
    return { erreur: traduitAdmin(cause) };
  }

  revalidatePath("/admin/sprints");
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin/sprints");
}

export async function supprimerSprintExistant(
  _precedent: Etat,
  donnees: FormData,
): Promise<Etat> {
  const id = Number(donnees.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { erreur: "Sprint introuvable." };
  }
  try {
    await supprimerSprint(id);
  } catch (cause) {
    return { erreur: traduitAdmin(cause) };
  }
  revalidatePath("/admin/sprints");
  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

export async function changerStatutSprint(
  _precedent: Etat,
  donnees: FormData,
): Promise<Etat> {
  const id = Number(donnees.get("id"));
  const statut = String(donnees.get("statut") ?? "") as StatutSprint;

  if (!Number.isInteger(id) || id <= 0) {
    return { erreur: "Sprint introuvable." };
  }
  if (!["DRAFT", "ACTIVE", "INACTIVE", "COMPLETED"].includes(statut)) {
    return { erreur: "Statut invalide." };
  }

  try {
    await changeStatutSprint(id, statut);
  } catch (cause) {
    return { erreur: traduitAdmin(cause) };
  }

  revalidatePath("/admin/sprints");
  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

export async function reverifiePaiement(
  _precedent: Etat,
  donnees: FormData,
): Promise<Etat> {
  const id = Number(donnees.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return { erreur: "Paiement introuvable." };
  }

  try {
    await reverifie(id);
  } catch (cause) {
    return { erreur: traduitAdmin(cause) };
  }

  revalidatePath("/admin/paiements");
  revalidatePath("/admin");
  return {};
}

export type EtatContenu = { erreur?: string; succes?: string };

function estUrlHttps(valeur: string): boolean {
  try {
    const u = new URL(valeur);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function enregistrerContenuSite(
  _precedent: EtatContenu,
  donnees: FormData,
): Promise<EtatContenu> {
  let brut: ContenuSiteAdmin;
  try {
    brut = JSON.parse(String(donnees.get("payload") ?? "{}")) as ContenuSiteAdmin;
  } catch {
    return { erreur: "Données du formulaire illisibles." };
  }

  const whatsappDisplay = String(brut.whatsappDisplay ?? "").trim();
  const whatsappHref = String(brut.whatsappHref ?? "").trim();
  if (!whatsappDisplay || whatsappDisplay.length > 30) {
    return {
      erreur: "Le numéro WhatsApp affiché est requis (30 caractères max).",
    };
  }
  if (!estUrlHttps(whatsappHref)) {
    return {
      erreur: "Le lien WhatsApp doit être une URL HTTPS valide (ex. https://wa.me/225...).",
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

  try {
    await modifierContenuSite({
      whatsappDisplay,
      whatsappHref,
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
    });
  } catch (cause) {
    return { erreur: traduitAdmin(cause) };
  }

  revalidatePath("/admin/contenu");
  revalidatePath("/");
  return { succes: "Contenu de la vitrine enregistré." };
}

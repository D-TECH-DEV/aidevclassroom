"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { api } from "@/lib/api";
import { fermeSession, ouvreSession } from "@/lib/admin/session";
import {
  changeStatut,
  changeStatutSprint,
  creerSprint,
  modifierSprint,
  reverifie,
  supprimerSprint,
  traduitAdmin,
  type SprintModifie,
} from "@/lib/admin/api";
import type {
  Connexion,
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

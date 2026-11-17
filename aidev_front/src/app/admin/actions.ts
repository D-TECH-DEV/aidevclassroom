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
} from "@/lib/admin/api";
import {
  parseCreationSprint,
  parseModificationSprint,
} from "@/lib/admin/sprint-form";
import { parseContenuSitePayload } from "@/lib/admin/contenu-form";
import type {
  Connexion,
  StatutInscription,
  StatutSprint,
} from "@/lib/admin/types";

export type Etat = { erreur?: string; succes?: boolean };
export type EtatContenu = { erreur?: string; succes?: string };

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
  revalidatePath("/admin/sprints");
  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

export async function creerNouveauSprint(
  _precedent: Etat,
  donnees: FormData,
): Promise<Etat> {
  const parsed = parseCreationSprint(donnees);
  if ("erreur" in parsed) return { erreur: parsed.erreur };

  try {
    await creerSprint(parsed.payload);
  } catch (cause) {
    return { erreur: traduitAdmin(cause) };
  }

  revalidatePath("/admin/sprints");
  revalidatePath("/admin");
  revalidatePath("/");
  if (donnees.get("mode") === "modale") {
    return { succes: true };
  }
  redirect("/admin/sprints");
}

export async function modifierSprintExistant(
  _precedent: Etat,
  donnees: FormData,
): Promise<Etat> {
  const parsed = parseModificationSprint(donnees);
  if ("erreur" in parsed) return { erreur: parsed.erreur };

  try {
    await modifierSprint(parsed.id, parsed.patch);
  } catch (cause) {
    return { erreur: traduitAdmin(cause) };
  }

  revalidatePath("/admin/sprints");
  revalidatePath(`/admin/sprints/${parsed.id}`);
  revalidatePath("/admin");
  revalidatePath("/");
  if (donnees.get("mode") === "modale") {
    return { succes: true };
  }
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
  revalidatePath(`/admin/sprints/${id}`);
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

export async function enregistrerContenuSite(
  _precedent: EtatContenu,
  donnees: FormData,
): Promise<EtatContenu> {
  const parsed = parseContenuSitePayload(
    String(donnees.get("payload") ?? "{}"),
  );
  if ("erreur" in parsed) return { erreur: parsed.erreur };

  try {
    await modifierContenuSite(parsed.payload);
  } catch (cause) {
    return { erreur: traduitAdmin(cause) };
  }

  revalidatePath("/admin/contenu");
  revalidatePath("/");
  return { succes: "Contenu de la vitrine enregistré." };
}

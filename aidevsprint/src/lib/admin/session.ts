import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

/**
 * La session d'administration, dans un cookie que le navigateur ne peut
 * pas lire.
 *
 * ── Pourquoi un cookie et pas le `localStorage` ──────────────────────
 * Le JWT de l'API donne accès à tout le back-office : inscriptions,
 * paiements, création d'administrateurs. Rangé dans le `localStorage`, il
 * est lisible par n'importe quel script de la page — une dépendance
 * compromise, une extension, une faille XSS, et le jeton part.
 *
 * Ici il vit dans un cookie `httpOnly` : le JavaScript de la page ne peut
 * pas y toucher, même le nôtre. Seul le serveur Next le lit, pour le
 * recopier dans l'en-tête `Authorization` des appels à l'API.
 *
 * ── Conséquence heureuse : pas de CORS ───────────────────────────────
 * Comme c'est le serveur Next qui appelle l'API, et non le navigateur, la
 * règle du CORS ne s'applique pas — c'est une règle de navigateur. Le
 * panneau d'administration fonctionne donc **avant** que Youssouf n'ouvre
 * son `Access-Control-Allow-Origin`, contrairement au site public.
 *
 * ── Durée ────────────────────────────────────────────────────────────
 * L'API signe ses jetons pour une heure (`JWT_EXPIRES_IN`, défaut `1h`) et
 * n'offre ni rafraîchissement ni déconnexion serveur. Le cookie expire
 * donc en même temps que le jeton : garder un cookie plus vieux que son
 * contenu ne ferait que produire des 401 incompréhensibles.
 */

const NOM = "aidevsprint_admin";

/**
 * Le chemin limite l'envoi du cookie aux pages d'administration. Il ne
 * part donc jamais avec une requête du site public.
 */
const CHEMIN = "/admin";

/** Repli d'une heure, la valeur par défaut annoncée par l'API. */
const DUREE_PAR_DEFAUT = 3600;

/**
 * L'API renvoie une durée écrite à la main : `"1h"`, `"30m"`, `"3600s"`.
 * Tout ce qui ne se lit pas retombe sur une heure, jamais sur l'infini.
 */
export function litDuree(expiresIn: unknown): number {
  if (typeof expiresIn === "number" && Number.isFinite(expiresIn)) {
    return expiresIn > 0 ? Math.floor(expiresIn) : DUREE_PAR_DEFAUT;
  }

  if (typeof expiresIn !== "string") return DUREE_PAR_DEFAUT;

  const trouve = /^(\d+)\s*([smhd])?$/i.exec(expiresIn.trim());
  if (!trouve) return DUREE_PAR_DEFAUT;

  const valeur = Number(trouve[1]);
  if (!Number.isFinite(valeur) || valeur <= 0) return DUREE_PAR_DEFAUT;

  const facteur = { s: 1, m: 60, h: 3600, d: 86400 }[
    (trouve[2] ?? "s").toLowerCase()
  ];

  return valeur * (facteur ?? 1);
}

/**
 * Le jeton de la session en cours, ou `null` si personne n'est connecté.
 *
 * ⚠️  `cache()` n'est pas là pour la performance, mais pour la correction.
 *
 * Quand une action serveur écrit puis que Next re-rend la page dans la
 * même requête, `cookies()` est consulté deux fois : une fois dans le
 * contexte de l'action, une fois dans celui du rendu. Next compare les
 * deux et lève alors :
 *
 *     InvariantError: Received an underlying cookies object that does not
 *     match either `cookies` or `mutableCookies`.
 *
 * Mesuré le 2026-11-02 sur un changement de statut d'inscription.
 * `cache()` mémorise la lecture pour toute la durée de la requête : il n'y
 * a donc plus qu'un seul accès, et plus de comparaison possible.
 */
export const litSession = cache(async (): Promise<string | null> => {
  const boite = await cookies();
  const valeur = boite.get(NOM)?.value;
  return valeur && valeur.length > 0 ? valeur : null;
});

/**
 * Ouvre la session. À n'appeler que depuis une action serveur : Next
 * refuse d'écrire un cookie pendant le rendu d'une page.
 */
export async function ouvreSession(jeton: string, expiresIn: unknown) {
  const boite = await cookies();

  boite.set(NOM, jeton, {
    httpOnly: true,
    // En développement le site est en clair sur `localhost` : exiger
    // `secure` empêcherait toute connexion locale.
    secure: process.env.NODE_ENV === "production",
    // `lax` suffit : aucune requête inter-site n'a besoin de ce cookie, et
    // ça ferme la porte au CSRF venu d'un autre domaine.
    sameSite: "lax",
    path: CHEMIN,
    maxAge: litDuree(expiresIn),
  });
}

/**
 * Ferme la session.
 *
 * L'API n'a pas de route de déconnexion et ne sait pas révoquer un jeton :
 * il reste techniquement valide jusqu'à son expiration. Effacer le cookie
 * est donc tout ce qu'on peut faire, et c'est aussi ce que la doc de
 * l'API recommande.
 */
export async function fermeSession() {
  const boite = await cookies();
  boite.delete({ name: NOM, path: CHEMIN });
}

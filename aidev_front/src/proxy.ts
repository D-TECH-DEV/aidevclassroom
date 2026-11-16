import { NextResponse, type NextRequest } from "next/server";

/**
 * Le garde-barrière des pages d'administration.
 *
 * Fichier `proxy.ts` et non `middleware.ts` : Next 16 a renommé la
 * convention, et l'ancien nom affiche un avertissement de dépréciation.
 *
 * ── Pourquoi un middleware et pas seulement le `redirect()` des pages ──
 * `cacheComponents` est actif : la coquille d'une page est servie
 * statiquement, et le `redirect()` d'un composant dynamique part dans le
 * flux RSC — c'est le navigateur qui l'exécute. Sans JavaScript, le
 * visiteur reste donc bloqué sur « Chargement… ». Mesuré le 2026-11-02.
 *
 * Ici la redirection est un vrai `307` HTTP, émis avant tout rendu. Elle
 * marche sans JavaScript, et elle évite de calculer une coquille qu'on
 * s'apprêtait à jeter.
 *
 * ── Ce que ça ne protège pas ──────────────────────────────────────────
 * Ce middleware ne vérifie que la *présence* du cookie, jamais sa
 * validité : vérifier la signature demanderait la clé de l'API, que nous
 * n'avons pas et ne devons pas avoir. Un cookie bricolé passe donc cette
 * porte — et se fait refuser par l'API à la requête suivante, qui renvoie
 * `401` et ramène à la connexion.
 *
 * La vraie frontière de sécurité est l'API. Celle-ci n'est qu'un confort.
 */

const COOKIE = "aidevsprint_admin";

export default function proxy(requete: NextRequest) {
  const connecte = Boolean(requete.cookies.get(COOKIE)?.value);
  const surLaConnexion = requete.nextUrl.pathname === "/admin/connexion";

  if (!connecte && !surLaConnexion) {
    return NextResponse.redirect(new URL("/admin/connexion", requete.url));
  }

  // Déjà connecté : la page de connexion n'a plus rien à offrir.
  if (connecte && surLaConnexion) {
    return NextResponse.redirect(new URL("/admin", requete.url));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Uniquement les pages d'administration. Le site public ne traverse pas
   * ce middleware : il n'a aucune raison de payer ce détour.
   */
  matcher: ["/admin", "/admin/:path*"],
};

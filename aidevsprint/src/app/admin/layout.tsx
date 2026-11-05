import type { Metadata } from "next";

/**
 * La racine des pages d'administration.
 *
 * Elle ne porte presque rien : juste le `noindex` et une colonne pleine
 * hauteur. La barre de navigation vit dans le groupe `(panneau)`, pour que
 * la page de connexion — qui est en dehors de ce groupe — ne l'affiche
 * pas. Proposer « Déconnexion » à quelqu'un qui n'est pas connecté serait
 * absurde.
 *
 * ⚠️  Ce panneau n'est pas une frontière de sécurité à lui seul. Il affiche
 *     ce que l'API accepte de donner, et c'est elle qui tranche : chaque
 *     route `/admin` exige un JWT `ADMIN` valide. Cacher un lien ici ne
 *     protège rien — c'est le cookie `httpOnly`, et le refus de l'API, qui
 *     protègent.
 */

export const metadata: Metadata = {
  title: "Administration — AIdevsprint",
  // Un back-office n'a rien à faire dans un index de recherche.
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-svh flex-1 flex-col">{children}</div>;
}

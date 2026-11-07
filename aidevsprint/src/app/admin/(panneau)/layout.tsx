import Link from "next/link";

import { deconnexion } from "../actions";

/**
 * Le panneau lit la session (cookie) à chaque requête : aucune de ses
 * pages ne peut être pré-rendue statiquement. Sans ceci, `next build`
 * échoue (« uncached or runtime data during prerendering »).
 */
export const dynamic = "force-dynamic";

/**
 * La coquille des pages connectées : barre de navigation et déconnexion.
 *
 * Elle ne reprend ni la navbar ni le pied de page du site public — ce
 * n'est pas une page de vente, et un « Réserver ma place » n'a rien à
 * faire au-dessus d'une liste d'inscrits.
 *
 * La page de connexion est volontairement en dehors de ce groupe.
 */

const LIENS = [
  { href: "/admin", libelle: "Tableau de bord" },
  { href: "/admin/sprints", libelle: "Sprints" },
  { href: "/admin/inscriptions", libelle: "Inscriptions" },
  { href: "/admin/paiements", libelle: "Paiements" },
] as const;

export default function PanneauLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-fg/10">
        <div
          className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center
                     justify-between gap-4 px-[clamp(1rem,4vw,3rem)] py-4"
        >
          <div className="flex flex-wrap items-center gap-[clamp(0.75rem,2.5vw,2rem)]">
            <Link
              href="/admin"
              className="font-mono text-small uppercase tracking-[0.25em] text-accent"
            >
              AIdevsprint
            </Link>

            <nav className="flex flex-wrap items-center gap-[clamp(0.75rem,2vw,1.5rem)]">
              {LIENS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="font-mono text-small text-fg/60"
                >
                  {l.libelle}
                </Link>
              ))}
            </nav>
          </div>

          {/* Un formulaire, pas un lien : se déconnecter écrit quelque
              chose (le cookie disparaît), donc ça passe par un POST. */}
          <form action={deconnexion}>
            <button
              type="submit"
              className="rounded-field border border-fg/20 px-3 py-1.5
                         font-mono text-small text-fg/60 outline-none
                         focus-visible:border-fg"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-[clamp(1rem,4vw,3rem)] py-[clamp(1.5rem,5svh,3rem)]">
        <div className="mx-auto w-full max-w-[90rem]">{children}</div>
      </main>
    </>
  );
}

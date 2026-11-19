import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquare02Icon, Logout01Icon } from "@hugeicons/core-free-icons";

import { NavigationAdmin } from "@/components/admin/NavigationAdmin";
import { LogoMarque } from "@/components/layout/LogoMarque";
import { deconnexion } from "../actions";

/**
 * Le panneau lit la session (cookie) à chaque requête : aucune de ses
 * pages ne peut être pré-rendue statiquement. Sans ceci, `next build`
 * échoue (« uncached or runtime data during prerendering »).
 */
export const dynamic = "force-dynamic";

export default function PanneauLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-fg/10 bg-surface/90
                   backdrop-blur-md"
      >
        <div
          className="relative mx-auto flex w-full max-w-[90rem] items-center
                     justify-between gap-3 px-[clamp(1rem,3vw,2.5rem)] py-3.5"
        >
          <div className="flex shrink-0 items-center gap-2.5">
            <Link
              href="/admin"
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <LogoMarque theme="dark" className="h-5 w-auto xl:h-6" />
            </Link>
            <span
              className="hidden rounded-pill border border-fg/15 bg-bg/60 px-2.5
                         py-0.5 font-mono text-[0.7rem] uppercase tracking-[0.15em]
                         text-fg/55 2xl:inline-block"
            >
              Admin
            </span>
          </div>

          <NavigationAdmin />

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              title="Voir la vitrine"
              aria-label="Voir la vitrine"
              className="hidden items-center gap-1.5 rounded-field border
                         border-fg/15 px-2.5 py-1.5 font-mono text-small
                         text-fg/65 transition-colors hover:border-fg/35
                         hover:text-fg sm:inline-flex xl:px-3"
            >
              <span className="hidden 2xl:inline">Vitrine</span>
              <HugeiconsIcon icon={LinkSquare02Icon} size={14} />
            </Link>

            <form action={deconnexion}>
              <button
                type="submit"
                title="Déconnexion"
                aria-label="Déconnexion"
                className="inline-flex items-center gap-1.5 rounded-field border
                           border-fg/20 bg-bg/50 px-2.5 py-1.5 font-mono text-small
                           text-fg/75 transition-colors outline-none
                           hover:border-fg/40 hover:text-fg focus-visible:border-fg
                           xl:px-3"
              >
                <HugeiconsIcon icon={Logout01Icon} size={14} />
                <span className="hidden 2xl:inline">Déconnexion</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 px-[clamp(1rem,4vw,3rem)] py-[clamp(1.5rem,4.5svh,3rem)]">
        <div className="mx-auto w-full max-w-[90rem]">{children}</div>
      </main>
    </>
  );
}

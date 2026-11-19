"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Cancel01Icon,
  CreditCardIcon,
  DashboardSquare01Icon,
  Menu01Icon,
  PaintBoardIcon,
  Rocket01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

type LienNav = {
  href: string;
  libelle: string;
  exact?: boolean;
  icone: IconSvgElement;
};

const LIENS: readonly LienNav[] = [
  {
    href: "/admin",
    libelle: "Tableau de bord",
    exact: true,
    icone: DashboardSquare01Icon,
  },
  {
    href: "/admin/sprints",
    libelle: "Sprints",
    icone: Rocket01Icon,
  },
  {
    href: "/admin/inscriptions",
    libelle: "Inscriptions",
    icone: UserGroupIcon,
  },
  {
    href: "/admin/paiements",
    libelle: "Paiements",
    icone: CreditCardIcon,
  },
  {
    href: "/admin/contenu",
    libelle: "Contenu",
    icone: PaintBoardIcon,
  },
];

function estActif(pathname: string, lien: LienNav): boolean {
  if (lien.exact) return pathname === lien.href;
  return pathname === lien.href || pathname.startsWith(`${lien.href}/`);
}

export function NavigationAdmin() {
  const pathname = usePathname() || "/admin";
  const [ouvertMobile, setOuvertMobile] = useState(false);

  return (
    <>
      <nav
        aria-label="Navigation administration"
        className="hidden shrink-0 items-center gap-0.5 rounded-pill border border-fg/10
                   bg-bg/60 p-1 lg:flex xl:gap-1"
      >
        {LIENS.map((lien) => {
          const actif = estActif(pathname, lien);
          return (
            <Link
              key={lien.href}
              href={lien.href}
              aria-current={actif ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap
                          rounded-pill border px-2.5 py-1.5 font-mono text-[0.8rem]
                          transition-colors outline-none focus-visible:border-fg
                          xl:px-3 xl:text-small ${
                            actif
                              ? "border-accent/50 bg-accent/15 font-semibold text-fg"
                              : "border-transparent text-fg/60 hover:bg-fg/5 hover:text-fg/90"
                          }`}
            >
              <HugeiconsIcon
                icon={lien.icone}
                size={15}
                className={actif ? "text-accent" : "text-fg/45"}
              />
              <span>{lien.libelle}</span>
            </Link>
          );
        })}
      </nav>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOuvertMobile((v) => !v)}
          aria-expanded={ouvertMobile}
          aria-label="Menu d'administration"
          className="flex items-center gap-2 rounded-field border border-fg/20
                     bg-bg/60 px-3 py-1.5 font-mono text-small text-fg/80
                     outline-none focus-visible:border-fg"
        >
          <HugeiconsIcon
            icon={ouvertMobile ? Cancel01Icon : Menu01Icon}
            size={16}
          />
          <span>Menu</span>
        </button>

        {ouvertMobile ? (
          <nav
            aria-label="Navigation administration mobile"
            className="absolute inset-x-0 top-full z-40 border-b border-fg/15
                       bg-surface px-4 py-3 shadow-none"
          >
            <div className="mx-auto flex max-w-[90rem] flex-col gap-1.5">
              {LIENS.map((lien) => {
                const actif = estActif(pathname, lien);
                return (
                  <Link
                    key={lien.href}
                    href={lien.href}
                    onClick={() => setOuvertMobile(false)}
                    aria-current={actif ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-field border
                                px-3.5 py-2.5 font-mono text-small transition-colors ${
                                  actif
                                    ? "border-accent/50 bg-accent/15 font-semibold text-fg"
                                    : "border-transparent text-fg/70 hover:bg-fg/5 hover:text-fg"
                                }`}
                  >
                    <HugeiconsIcon
                      icon={lien.icone}
                      size={16}
                      className={actif ? "text-accent" : "text-fg/45"}
                    />
                    <span>{lien.libelle}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </div>
    </>
  );
}

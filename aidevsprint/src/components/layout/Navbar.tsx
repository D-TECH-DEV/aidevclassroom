"use client";

import { useEffect, useRef, useState } from "react";

import { BoutonReserver } from "@/components/inscription/BoutonReserver";
import { MenuPleinEcran } from "./MenuPleinEcran";

const ANCRES = [
  { href: "#methode", label: "Méthode" },
  { href: "#parcours", label: "Parcours" },
  { href: "#formateurs", label: "Formateurs" },
  { href: "#faq", label: "FAQ" },
] as const;

/**
 * Barre de navigation flottante.
 *
 * Trois éléments posés sur le hero, sans bandeau : le logo à gauche, la
 * capsule sombre et floutée des ancres au centre, le bouton à droite. Le langage capsule vient de l'affiche : badge, pastilles,
 * boutons, tout y est en capsule pleine.
 *
 * Sous `lg` : un bouton « Menu » ouvre un écran plein (MenuPleinEcran),
 * et une capsule basse collante garde l'action sous le pouce. Pas d'icône
 * burger seule — le mot est lisible par tout le monde.
 */
export function Navbar({
  inscrits,
  quota,
}: {
  inscrits: number | null;
  quota: number | null;
}) {
  const [depasseHero, setDepasseHero] = useState(false);
  const sentinelle = useRef<HTMLDivElement>(null);

  // IntersectionObserver plutôt qu'un écouteur de scroll : pas de calcul
  // à chaque pixel parcouru.
  useEffect(() => {
    const cible = sentinelle.current;
    if (!cible) return;
    const io = new IntersectionObserver(([entree]) =>
      setDepasseHero(!entree.isIntersecting),
    );
    io.observe(cible);
    return () => io.disconnect();
  }, []);

  const placesRestantes =
    inscrits !== null && quota !== null ? quota - inscrits : null;

  return (
    <>
      <div ref={sentinelle} aria-hidden className="absolute top-0 h-20 w-full" />

      {/* L'en-tête ne peint rien : seule la capsule a un fond. */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300
                    ease-[cubic-bezier(0.23,1,0.32,1)]
                    ${depasseHero ? "border-b border-fg/10 bg-bg/90 backdrop-blur-xl" : ""}`}
      >
        {/* L'encoche : sans ce padding, la capsule passe dessous. */}
        <div className="shell pb-4 pt-[calc(1rem+env(safe-area-inset-top,0rem))]">
          <nav
            aria-label="Navigation principale"
            className="flex items-center justify-between gap-6"
          >
            <a
              href="#top"
              className="text-h3 font-bold tracking-tight text-fg"
              aria-label="AIdevsprint, retour en haut"
            >
              <span className="text-accent">AI</span>devsprint
            </a>

            {/* La capsule du centre : sombre, floutée, arrondie. */}
            <ul
              className={`hidden items-center gap-1 rounded-pill border
                          border-fg/15 p-1 backdrop-blur-xl transition-colors
                          duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]
                          lg:flex ${
                            depasseHero
                              ? "border-transparent bg-transparent backdrop-blur-none"
                              : "bg-bg/60"
                          }`}
            >
              {ANCRES.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    className="block rounded-pill px-5 py-2 text-small font-semibold
                               text-fg transition-colors duration-[160ms]
                               ease-[cubic-bezier(0.23,1,0.32,1)]
                               hoverable:hover:bg-fg/15"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>

            {/* La visibilité est portée par l'enveloppe, pas par le bouton :
                un `hidden` passé en className ne gagne pas à coup sûr contre
                le `inline-flex` de base — l'ordre dépend du CSS généré. */}
            <div className="hidden lg:block">
              <BoutonReserver taille="sm" />
            </div>

            {/* Sous lg, les ancres sont masquées : sans ce menu, elles
                seraient tout simplement inatteignables. */}
            <MenuPleinEcran ancres={ANCRES} />
          </nav>
        </div>
      </header>

      {/* ── Mobile : l'action reste sous le pouce ───────────────────── */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 transition-transform
                    duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] lg:hidden
                    ${depasseHero ? "translate-y-0" : "translate-y-[150%]"}`}
      >
        {/* La barre d'accueil de l'iPhone : sans ce padding, le bouton
            se retrouve dessous et devient difficile à atteindre. */}
        <div className="shell pb-[calc(1rem+env(safe-area-inset-bottom,0rem))]">
          <div
            className="flex items-center justify-between gap-4 rounded-pill
                       border border-fg/15 bg-bg/85 py-3 pl-6 pr-3
                       backdrop-blur-xl"
          >
            <p className="font-mono text-small">
              {placesRestantes !== null ? (
                <>
                  <span className="font-bold text-accent">
                    {placesRestantes}
                  </span>{" "}
                  <span className="text-fg/70">places restantes</span>
                </>
              ) : (
                <span className="text-fg/50">Places [À DÉTERMINER]</span>
              )}
            </p>

            <BoutonReserver taille="sm">Réserver</BoutonReserver>
          </div>
        </div>
      </div>
    </>
  );
}

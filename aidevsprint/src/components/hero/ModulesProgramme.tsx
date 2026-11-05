"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

/**
 * Les 4 temps de la journée, à droite du hero.
 *
 * Traités comme une séquence, pas comme une liste : un fil vertical en
 * dégradé relie les étapes, du vert au bleu, et la journée se lit de haut
 * en bas. Le chiffre fantôme en fond donne l'échelle éditoriale sans
 * ajouter d'ornement.
 *
 * Contenu repris de l'affiche, mot pour mot. Les glyphes reprennent ceux
 * qui flottent sur l'affiche — pas d'emoji, pas d'icônes génériques.
 *
 * Visible à partir de `xl` : en dessous, le compte à rebours garde toute
 * la largeur et les modules réapparaissent dans la section programme.
 */

const Glyphe = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className="size-[1.125rem] shrink-0 stroke-current"
    fill="none"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const MODULES = [
  {
    titre: "Le design de ton site",
    glyphe: (
      <Glyphe>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 9v11" />
      </Glyphe>
    ),
  },
  {
    titre: "Le code, en guidant l'IA",
    glyphe: (
      <Glyphe>
        <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
      </Glyphe>
    ),
  },
  {
    titre: "Ton admin + ton chatbot IA",
    glyphe: (
      <Glyphe>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M7 9l2.5 2L7 13M12.5 13H17" />
      </Glyphe>
    ),
  },
  {
    titre: "Ton site déployé en ligne",
    glyphe: (
      <Glyphe>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </Glyphe>
    ),
  },
];

export function ModulesProgramme() {
  const liste = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ delay: 0.2 });
        // Le fil se trace d'abord, les étapes le suivent.
        tl.from("[data-fil]", {
          scaleY: 0,
          duration: 0.7,
          ease: "power4.out",
          transformOrigin: "top center",
        }).from(
          "[data-etape]",
          { x: 16, opacity: 0, duration: 0.5, stagger: 0.07, ease: "power4.out" },
          "-=0.45",
        );
      });
      return () => mm.revert();
    },
    { scope: liste },
  );

  return (
    <ol
      ref={liste}
      className="relative hidden w-[clamp(20rem,28vw,26rem)] flex-col
                 gap-[clamp(1rem,2.6svh,1.75rem)] py-2 xl:flex"
    >
      {/* Le fil de la journée : vert en haut, bleu en bas. */}
      <span
        aria-hidden
        data-fil
        className="absolute bottom-6 left-[1.0625rem] top-6 w-px"
        style={{
          background:
            "linear-gradient(to bottom, #2EE66B 0%, #1A9BBA 55%, #0B63F6 100%)",
        }}
      />

      {MODULES.map(({ titre, glyphe }, i) => (
        <li
          key={titre}
          data-etape
          className="group relative flex items-center gap-5"
        >
          {/* Le chiffre fantôme, derrière, qui donne l'échelle. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-3 left-10 select-none
                       font-mono text-[3.5rem] font-bold leading-none text-fg/[0.045]"
          >
            {i + 1}
          </span>

          <span
            className="relative z-10 grid size-[2.125rem] shrink-0 place-items-center
                       rounded-pill border border-accent bg-bg font-mono
                       text-small font-bold text-accent transition-colors
                       duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)]
                       hoverable:group-hover:bg-accent
                       hoverable:group-hover:text-on-accent"
          >
            {i + 1}
          </span>

          <span
            className="relative z-10 flex items-center gap-3 text-fg/80
                       transition-[color,transform] duration-[200ms]
                       ease-[cubic-bezier(0.23,1,0.32,1)]
                       hoverable:group-hover:translate-x-1
                       hoverable:group-hover:text-fg"
          >
            <span className="text-accent">{glyphe}</span>
            <span className="text-body font-semibold leading-tight">
              {titre}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

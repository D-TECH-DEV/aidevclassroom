"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { BoutonReserver } from "@/components/inscription/BoutonReserver";

type Ancre = { href: string; label: string };

/**
 * Menu plein écran, pour tout ce qui est sous `lg`.
 *
 * Pas un burger réflexe : le déclencheur porte le mot « Menu », parce
 * qu'une icône à trois traits seule n'est comprise que par les habitués.
 * Les entrées entrent en cascade, chacune à sa taille de titre — le menu
 * est un écran à part entière, pas un tiroir à liens.
 */
export function MenuPleinEcran({ ancres }: { ancres: readonly Ancre[] }) {
  const [ouvert, setOuvert] = useState(false);
  const panneau = useRef<HTMLDivElement>(null);

  // Échap pour fermer, et on bloque le défilement de la page derrière.
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    const defilement = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", surTouche);
    return () => {
      document.body.style.overflow = defilement;
      document.removeEventListener("keydown", surTouche);
    };
  }, [ouvert]);

  useGSAP(
    () => {
      if (!ouvert || !panneau.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(panneau.current!.querySelectorAll("[data-entree]"), {
          y: 24,
          opacity: 0,
          duration: 0.45,
          // cascade courte : au-delà de 80ms l'interface paraît lente
          stagger: 0.06,
          ease: "power4.out",
        });
      });
      return () => mm.revert();
    },
    { dependencies: [ouvert] },
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        className="rounded-pill border border-fg/15 bg-bg/60 px-5 py-3
                   text-small font-semibold text-fg backdrop-blur-xl
                   active:brightness-75 lg:hidden"
      >
        Menu
      </button>

      {ouvert && (
        <div
          ref={panneau}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="fixed inset-0 z-[60] flex flex-col bg-bg lg:hidden"
        >
          <div className="shell flex items-center justify-between
                          pb-4 pt-[calc(1rem+env(safe-area-inset-top,0rem))]">
            <p className="text-h3 font-bold tracking-tight">
              <span className="text-accent">AI</span>devsprint
            </p>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="rounded-pill border border-fg/15 px-5 py-3 text-small
                         font-semibold text-fg active:brightness-75"
            >
              Fermer
            </button>
          </div>

          <nav className="shell flex flex-1 flex-col justify-center gap-2">
            {ancres.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                data-entree
                onClick={() => setOuvert(false)}
                // 2,75rem de cible tactile minimum, largement dépassé ici
                className="py-3 text-h2 font-bold tracking-tight text-fg
                           active:text-accent"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="shell pb-[calc(1.5rem+env(safe-area-inset-bottom,0rem))]">
            <div data-entree>
              {/* Le menu se referme d'abord : deux couches plein écran
                  l'une sur l'autre, on ne sait plus laquelle répond. */}
              <BoutonReserver
                pleineLargeur
                onAvantOuverture={() => setOuvert(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

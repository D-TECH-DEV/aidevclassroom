"use client";

import { createElement, useRef, type ElementType, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Le socle d'animation du site : un bloc se révèle quand on l'atteint.
 *
 * Un seul vocabulaire pour toutes les sections, arrêté avec Malik le
 * 2026-10-20 — monter de 1rem en apparaissant, 500 ms, `power3.out`, les
 * enfants directs en cascade à 70 ms. C'est la gestuelle des 4 temps du
 * hero : le site bouge d'une seule main.
 *
 * `once: true` puis `kill()` : chaque ScrollTrigger se détruit après son
 * passage. Rien ne reste accroché au scroll une fois la section lue — ce
 * qui compte quand huit sections s'empilent sur la même page.
 *
 * Ce composant remplace le `<div className="shell">` de la section plutôt
 * que de s'ajouter autour : le DOM reste identique, et la section reste un
 * composant serveur. Seul ce conteneur est client. `as` permet de remplacer
 * aussi bien un `<article>` ou une `<li>` — sans lui, révéler un bloc plus
 * fin qu'une section obligeait à insérer un `div` qui cassait la grille.
 *
 * Le flash : le HTML est pré-rendu visible, et GSAP ne masque qu'à
 * l'hydratation. Un bloc déjà à l'écran au chargement peut donc clignoter.
 * C'est volontaire dans ce sens-là — si le JS ne charge jamais, tout reste
 * lisible. Masquer en CSS aurait rendu la page blanche sans JS. En
 * pratique le déclenchement est à 85 % du viewport, donc seuls les blocs
 * déjà visibles sont concernés, et il n'y en a quasiment aucun sous le hero.
 */
export function Reveal({
  children,
  className = "",
  /** Décalage entre enfants directs, en secondes. 0 pour tout d'un bloc. */
  cascade = 0.07,
  /** La balise rendue. `div` par défaut, `article` pour un profil, etc. */
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  cascade?: number;
  as?: ElementType;
}) {
  const bloc = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const element = bloc.current;
      if (!element) return;

      const mm = gsap.matchMedia();

      // Sous `prefers-reduced-motion`, rien n'est enregistré du tout :
      // pas d'animation, pas de ScrollTrigger, le contenu est à sa place.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const enfants = Array.from(element.children);
        if (enfants.length === 0) return;

        const animation = gsap.from(enfants, {
          opacity: 0,
          y: "1rem",
          duration: 0.5,
          ease: "power3.out",
          stagger: cascade,
          scrollTrigger: {
            trigger: element,
            start: "top 85%",
            once: true,
          },
          // Une fois posé, plus personne n'écoute le scroll pour ce bloc.
          onComplete: () => animation.scrollTrigger?.kill(),
        });
      });

      return () => mm.revert();
    },
    { scope: bloc, dependencies: [cascade] },
  );

  return createElement(as, { ref: bloc, className }, children);
}

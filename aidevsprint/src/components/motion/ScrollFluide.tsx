"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

import { enregistreDefilement } from "@/components/motion/defilement";

gsap.registerPlugin(ScrollTrigger);

/**
 * Le scroll inertiel, branché une seule fois pour tout le site.
 *
 * Lenis et GSAP touchent tous les deux au scroll : laissés chacun dans son
 * coin, ScrollTrigger calcule les positions sur un scroll que Lenis a déjà
 * déplacé, et les révélations se déclenchent au mauvais endroit. C'est la
 * règle de docs/stack.md — un seul endroit branche Lenis sur le ticker GSAP
 * et sur `ScrollTrigger.update()`. C'est ici.
 *
 * `lagSmoothing(0)` : par défaut GSAP « rattrape » les images perdues en
 * sautant dans le temps. Avec un scroll piloté image par image, ce rattrapage
 * se voit comme un à-coup.
 *
 * Sous `prefers-reduced-motion`, Lenis n'est jamais créé : le scroll natif
 * du navigateur reprend la main, et rien ne s'interpose.
 *
 * Ne rend rien — c'est un effet, pas un élément.
 */
export function ScrollFluide() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const lenis = new Lenis({
      // Assez court pour que la page réponde, assez long pour qu'elle glisse.
      duration: 1.05,
      // Le tactile garde son inertie native : la refaire en JS donne
      // toujours une sensation en retard d'un doigt.
      syncTouch: false,
    });

    lenis.on("scroll", ScrollTrigger.update);

    // La modale d'inscription a besoin de le mettre en pause. Voir
    // `defilement.ts` : sans ça la page glisse derrière le panneau.
    enregistreDefilement(lenis);

    // Lenis avance au rythme du ticker GSAP, pas sur son propre `raf` :
    // une seule boucle d'animation pour toute la page.
    const avance = (temps: number) => lenis.raf(temps * 1000);
    gsap.ticker.add(avance);
    gsap.ticker.lagSmoothing(0);

    return () => {
      enregistreDefilement(null);
      gsap.ticker.remove(avance);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return null;
}

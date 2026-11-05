"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { LanyardProps } from "@/components/Lanyard";

/**
 * Le badge suspendu, chargé seulement quand on s'en approche.
 *
 * `Lanyard` ouvre un contexte WebGL Three.js. La section en affiche trois :
 * montés d'emblée, c'est trois scènes 3D qui tournent dès l'ouverture de la
 * page, alors que la section est à plusieurs écrans plus bas. Sur un
 * téléphone de milieu de gamme, ça se paie comptant.
 *
 * Trois verrous ici :
 *
 * 1. `dynamic(..., { ssr: false })` — Three.js sort du bundle initial et
 *    n'est téléchargé qu'au premier badge qui en a besoin.
 * 2. L'`IntersectionObserver` ne monte le canvas qu'à 200 px du viewport,
 *    puis se débranche. Un badge jamais atteint n'est jamais construit.
 * 3. `delaiMs` écarte les montages dans le temps. Sur un grand écran, deux
 *    badges peuvent entrer dans la marge d'observation en même temps :
 *    deux scènes 3D se construisaient alors dans la même image, et c'est
 *    exactement là que le défilement décroche. Avec un décalage, chacune
 *    prend son tour.
 *
 * Le cadre garde sa taille dans les deux états : rien ne se décale quand le
 * canvas arrive.
 */
const Lanyard = dynamic(() => import("@/components/Lanyard"), { ssr: false });

export function BadgeSuspendu({
  delaiMs = 0,
  ...props
}: LanyardProps & { delaiMs?: number }) {
  const cadre = useRef<HTMLDivElement>(null);
  const [approche, setApproche] = useState(false);

  useEffect(() => {
    const element = cadre.current;
    if (!element) return;

    let minuterie: ReturnType<typeof setTimeout> | undefined;

    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (!entree.isIntersecting) return;
        // Une fois le rendez-vous pris, plus rien à observer : le délai
        // qui suit ne doit pas pouvoir être relancé par un second passage.
        observateur.disconnect();
        minuterie = setTimeout(() => setApproche(true), delaiMs);
      },
      { rootMargin: "200px 0px" },
    );

    observateur.observe(element);
    return () => {
      observateur.disconnect();
      clearTimeout(minuterie);
    };
  }, [delaiMs]);

  return (
    <div ref={cadre} className="size-full">
      {approche && <Lanyard {...props} />}
    </div>
  );
}

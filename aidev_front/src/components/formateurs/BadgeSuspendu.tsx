"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { LanyardProps } from "@/components/Lanyard";

const Lanyard = dynamic(() => import("@/components/Lanyard"), { ssr: false });

export function BadgeSuspendu({
  delaiMs = 0,
  ...props
}: LanyardProps & { delaiMs?: number }) {
  const cadre = useRef<HTMLDivElement>(null);
  const [actif, setActif] = useState(false);

  useEffect(() => {
    const element = cadre.current;
    if (!element) return;

    let minuterie: ReturnType<typeof setTimeout> | undefined;

    // Monte la scène 3D à l'approche du viewport, et la démonte si on s'éloigne
    // fortement pour ne garder qu'un seul contexte WebGL actif à la fois.
    const obsEntree = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          clearTimeout(minuterie);
          minuterie = setTimeout(() => setActif(true), delaiMs);
        }
      },
      { rootMargin: "150px 0px" },
    );

    const obsSortie = new IntersectionObserver(
      ([entree]) => {
        if (!entree.isIntersecting) {
          clearTimeout(minuterie);
          setActif(false);
        }
      },
      { rootMargin: "450px 0px" },
    );

    obsEntree.observe(element);
    obsSortie.observe(element);

    return () => {
      obsEntree.disconnect();
      obsSortie.disconnect();
      clearTimeout(minuterie);
    };
  }, [delaiMs]);

  return (
    <div ref={cadre} className="size-full">
      {actif && <Lanyard {...props} />}
    </div>
  );
}

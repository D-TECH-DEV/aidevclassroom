"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

type Props = {
  inscrits: number | null;
  quota: number | null;
};

/**
 * Jauge de places. Se remplit une fois au montage, de 0 jusqu'à la valeur
 * réelle, puis ne bouge plus. Urgence sans agressivité.
 */
export function SeatsGauge({ inscrits, quota }: Props) {
  const barre = useRef<HTMLDivElement>(null);

  const connu = inscrits !== null && quota !== null && quota > 0;
  const pourcentage = connu ? Math.min(100, (inscrits / quota) * 100) : 0;
  const complet = connu && inscrits >= quota;

  useGSAP(
    () => {
      if (!connu) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          barre.current,
          { scaleX: 0 },
          {
            scaleX: pourcentage / 100,
            duration: 0.9,
            ease: "power4.out",
            transformOrigin: "left center",
          },
        );
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(barre.current, {
          scaleX: pourcentage / 100,
          transformOrigin: "left center",
        });
      });
      return () => mm.revert();
    },
    { dependencies: [pourcentage, connu] },
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        className="h-2 w-full overflow-hidden rounded-pill bg-fg/10"
        role="progressbar"
        aria-valuenow={connu ? inscrits : undefined}
        aria-valuemin={0}
        aria-valuemax={connu ? quota : undefined}
        aria-label="Places réservées"
      >
        <div
          ref={barre}
          className="h-full w-full origin-left rounded-pill"
          style={{
            background: "var(--gradient-signature)",
            transform: "scaleX(0)",
          }}
        />
      </div>

      <p className="font-mono text-small text-fg/70">
        {connu ? (
          <>
            <span className="text-fg">
              {inscrits} / {quota}
            </span>{" "}
            places réservées
            {complet && <span className="text-accent"> · complet</span>}
          </>
        ) : (
          <span className="text-fg/50">
            Nombre de places [À DÉTERMINER]
          </span>
        )}
      </p>
    </div>
  );
}

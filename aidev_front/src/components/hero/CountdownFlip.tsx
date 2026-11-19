"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

type Parts = { j: string; h: string; m: string; s: string };

const VIDE: Parts = { j: "--", h: "--", m: "--", s: "--" };

function calcule(cible: number): Parts {
  const reste = Math.max(0, cible - Date.now());
  const sec = Math.floor(reste / 1000);
  const deuxChiffres = (n: number) => String(n).padStart(2, "0");
  return {
    j: deuxChiffres(Math.floor(sec / 86400)),
    h: deuxChiffres(Math.floor(sec / 3600) % 24),
    m: deuxChiffres(Math.floor(sec / 60) % 60),
    s: deuxChiffres(sec % 60),
  };
}

/**
 * Un chiffre. Bascule en 3D sur l'axe X quand sa valeur change — et seulement
 * quand elle change, pour ne pas réanimer les heures à chaque seconde.
 */
function Chiffre({ valeur }: { valeur: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const precedent = useRef(valeur);

  useGSAP(
    () => {
      if (precedent.current === valeur) return;
      precedent.current = valeur;

      // `prefers-reduced-motion` : la valeur change, sans mouvement.
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ref.current,
          { rotateX: -90, opacity: 0 },
          {
            rotateX: 0,
            opacity: 1,
            duration: 0.4,
            // équivaut à --ease-out-strong : cubic-bezier(0.23, 1, 0.32, 1)
            ease: "power4.out",
          },
        );
      });
      return () => mm.revert();
    },
    { dependencies: [valeur] },
  );

  return (
    <span
      ref={ref}
      className="inline-block tabular-nums [transform-style:preserve-3d]"
    >
      {valeur}
    </span>
  );
}

function Groupe({ valeur, label }: { valeur: string; label: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <div
        className="font-mono font-bold leading-[0.85] tracking-tighter
                   text-[length:var(--text-countdown)] [perspective:50rem]"
      >
        {valeur.split("").map((c, i) => (
          <Chiffre key={i} valeur={c} />
        ))}
      </div>
      <span className="font-mono text-small font-bold uppercase tracking-[0.25em] text-fg">
        {label}
      </span>
    </div>
  );
}

/**
 * Le deux-points entre deux groupes.
 *
 * Même taille et même interligne que les chiffres, donc il s'aligne tout
 * seul sur eux et non sur les libellés — la rangée est en `items-start`.
 * Blanc à 30 % : il sépare sans se disputer la lecture avec les nombres.
 */
function Separateur() {
  return (
    <span
      aria-hidden
      className="font-mono font-bold leading-[0.85] tracking-tighter
                 text-[length:var(--text-countdown)] text-fg/30"
    >
      :
    </span>
  );
}

export function CountdownFlip({ dateDebut }: { dateDebut: string | null }) {
  // Rendu serveur et premier rendu client identiques : on part de `--`,
  // le vrai décompte démarre après le montage. Pas d'écart d'hydratation.
  const [parts, setParts] = useState<Parts>(VIDE);

  useEffect(() => {
    if (!dateDebut) return;
    const cible = new Date(dateDebut).getTime();
    if (Number.isNaN(cible)) return;

    setParts(calcule(cible));
    const id = setInterval(() => setParts(calcule(cible)), 1000);
    return () => clearInterval(id);
  }, [dateDebut]);

  const groupes = [
    { valeur: parts.j, label: "jours" },
    { valeur: parts.h, label: "heures" },
    { valeur: parts.m, label: "min" },
    { valeur: parts.s, label: "sec" },
  ];

  return (
    <div
      // L'écart se resserre par rapport à l'ancienne version : ce sont les
      // deux-points qui séparent maintenant, plus le vide.
      className="flex items-start gap-2 sm:gap-3 lg:gap-4"
      role="timer"
      aria-live="off"
      aria-label="Temps restant avant le début de la formation"
    >
      {groupes.map(({ valeur, label }, i) => (
        <Fragment key={label}>
          {i > 0 && <Separateur />}
          <Groupe valeur={valeur} label={label} />
        </Fragment>
      ))}
    </div>
  );
}

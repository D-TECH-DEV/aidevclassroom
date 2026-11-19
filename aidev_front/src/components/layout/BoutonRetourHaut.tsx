"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon } from "@hugeicons/core-free-icons";

const RAYON = 20;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

export function BoutonRetourHaut() {
  const [progression, setProgression] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let rafId = 0;

    const mettreAJour = () => {
      rafId = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const hauteur =
        document.documentElement.scrollHeight - window.innerHeight;
      const ratio = hauteur > 0 ? Math.min(1, Math.max(0, y / hauteur)) : 0;
      setProgression(ratio);
      setVisible(y > 220);
    };

    const auScroll = () => {
      if (!rafId) rafId = window.requestAnimationFrame(mettreAJour);
    };

    mettreAJour();
    window.addEventListener("scroll", auScroll, { passive: true });
    window.addEventListener("resize", auScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", auScroll);
      window.removeEventListener("resize", auScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const offset = CIRCONFERENCE * (1 - progression);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Revenir en haut de la page"
      title="Revenir en haut"
      className={`fixed bottom-24 right-5 z-40 grid size-12 place-items-center
                  rounded-full bg-surface/90 text-accent shadow-lg backdrop-blur-md
                  transition-all duration-300 outline-none
                  hover:scale-105 hover:bg-surface focus-visible:ring-2
                  focus-visible:ring-accent lg:bottom-6 lg:right-6 ${
                    visible
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-4 opacity-0"
                  }`}
    >
      <svg
        viewBox="0 0 48 48"
        className="pointer-events-none absolute inset-0 size-full -rotate-90"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="adc-scroll-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2EE66B" />
            <stop offset="100%" stopColor="#0B63F6" />
          </linearGradient>
        </defs>
        <circle
          cx="24"
          cy="24"
          r={RAYON}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="2.5"
        />
        <circle
          cx="24"
          cy="24"
          r={RAYON}
          fill="none"
          stroke="url(#adc-scroll-ring)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={CIRCONFERENCE}
          strokeDashoffset={offset}
        />
      </svg>

      <HugeiconsIcon icon={ArrowUp01Icon} size={18} className="relative" />
    </button>
  );
}

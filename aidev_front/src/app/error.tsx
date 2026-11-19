"use client";

import { useEffect } from "react";
import { CtaButton } from "@/components/ui/CtaButton";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center py-[clamp(4rem,14svh,9rem)]">
      <div className="shell flex justify-center">
        <div
          className="flex w-full max-w-[38rem] flex-col items-center gap-4 rounded-card
                     border border-fg/15 bg-surface px-[clamp(1.5rem,5vw,3rem)]
                     py-[clamp(2rem,6svh,3.5rem)] text-center"
        >
          <p className="font-mono text-small uppercase tracking-[0.16em] text-accent">
            Erreur inattendue
          </p>
          <h1 className="text-h2 font-bold leading-[1.1] tracking-tight">
            Une erreur s&apos;est produite.
          </h1>
          <p className="max-w-[42ch] text-body text-fg/70">
            Le chargement de la page a été interrompu. Tu peux réessayer ou revenir à
            l&apos;accueil.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <CtaButton type="button" variante="vert" taille="sm" onClick={() => reset()}>
              Réessayer
            </CtaButton>
            <CtaButton href="/" taille="sm">
              Retour à l&apos;accueil
            </CtaButton>
          </div>
        </div>
      </div>
    </main>
  );
}

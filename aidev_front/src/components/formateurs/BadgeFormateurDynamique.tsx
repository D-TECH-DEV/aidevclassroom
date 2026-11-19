"use client";

import { useEffect, useState } from "react";
import type { FormateurPublic } from "@/lib/contenu";
import { BadgeSuspendu } from "./BadgeSuspendu";
import { genererTextureBadge } from "./genererTextureBadge";

let prechargementLance = false;

function prechargerLanyardPendantRepos() {
  if (prechargementLance) return;
  prechargementLance = true;
  void import("@/components/Lanyard");
}

export function BadgeFormateurDynamique({
  formateur,
  size,
  strapLength,
  breeze,
  delaiMs,
}: {
  formateur: FormateurPublic;
  size: number;
  strapLength: number;
  breeze: number;
  delaiMs: number;
}) {
  const [textureGeneree, setTextureGeneree] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    const lancer = () => {
      prechargerLanyardPendantRepos();
      if (formateur.badgePath) return;
      void genererTextureBadge(formateur).then((url) => {
        if (actif && url) setTextureGeneree(url);
      });
    };

    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    if (typeof ric === "function") {
      const id = ric(lancer, { timeout: 1500 });
      return () => {
        actif = false;
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(id);
      };
    }

    const timer = setTimeout(lancer, 600);
    return () => {
      actif = false;
      clearTimeout(timer);
    };
  }, [formateur]);

  const frontImage = formateur.badgePath || textureGeneree;
  if (!frontImage) {
    return (
      <div className="mx-auto h-full max-w-[22rem] rounded-card border border-accent/20 bg-surface/40" />
    );
  }

  return (
    <BadgeSuspendu
      frontImage={frontImage}
      imageFit="cover"
      cardColor="#010F06"
      strapColor="#0A0A0A"
      size={size}
      strapLength={strapLength}
      breeze={breeze}
      intro={true}
      delaiMs={delaiMs}
    />
  );
}

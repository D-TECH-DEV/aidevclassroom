"use client";

import { useOuvrirReprendrePaiement } from "@/components/paiement/ModaleReprendrePaiement";
import { CtaButton } from "@/components/ui/CtaButton";

type Props = {
  taille?: "sm" | "lg";
  pleineLargeur?: boolean;
  className?: string;
  onAvantOuverture?: () => void;
  children?: React.ReactNode;
};

/**
 * Bouton bleu « Compléter mon inscription » : ouvre le popup de complétion
 * sur la landing page, ou redirige vers `/paiement/reprendre` hors contexte.
 */
export function BoutonCompleterInscription({
  taille = "lg",
  pleineLargeur = false,
  className = "",
  onAvantOuverture,
  children = "Compléter mon inscription",
}: Props) {
  const ouvre = useOuvrirReprendrePaiement();

  if (!ouvre) {
    return (
      <CtaButton
        href="/paiement/reprendre"
        variante="bleu"
        taille={taille}
        pleineLargeur={pleineLargeur}
        className={className}
      >
        {children}
      </CtaButton>
    );
  }

  return (
    <CtaButton
      type="button"
      variante="bleu"
      taille={taille}
      pleineLargeur={pleineLargeur}
      className={className}
      onClick={() => {
        onAvantOuverture?.();
        ouvre();
      }}
    >
      {children}
    </CtaButton>
  );
}

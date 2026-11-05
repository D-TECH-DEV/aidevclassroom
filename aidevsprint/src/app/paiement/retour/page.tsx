import { Suspense } from "react";
import type { Metadata } from "next";

import { Footer } from "@/components/layout/Footer";
import { RetourPaiement } from "@/components/paiement/RetourPaiement";

/**
 * `/paiement/retour` — l'adresse où Paystack ramène le visiteur.
 *
 * ⚠️  Elle doit être déclarée côté serveur, dans `PAYSTACK_CALLBACK_URL` :
 *     https://ai-dev-sprint.com/paiement/retour
 * Sans ça, Paystack renvoie ailleurs et le participant ne voit jamais la
 * confirmation. C'est à Youssouf de la poser — voir docs/stack.md.
 *
 * Pas de navbar ici : elle porte un « Réserver ma place » qui ouvre la
 * modale, et proposer de réserver à quelqu'un qui vient de payer n'a pas
 * de sens. Le pied de page reste, pour ne pas laisser la page sans issue.
 */

export const metadata: Metadata = {
  title: "Paiement — AIdevsprint #1",
  // Une page de transaction n'a rien à faire dans un index de recherche,
  // et son adresse porte une référence de paiement.
  robots: { index: false, follow: false },
};

export default function PagePaiementRetour() {
  return (
    <>
      <main
        id="top"
        className="flex flex-1 items-center justify-center
                   py-[clamp(4rem,14svh,9rem)]"
      >
        <div className="shell flex justify-center">
          <div className="w-full max-w-[42rem]">
            {/* `useSearchParams` suspend au rendu : sans cette frontière,
                toute la page attendrait le navigateur. */}
            <Suspense
              fallback={
                <p className="text-center text-body text-fg/50">
                  On vérifie ton paiement…
                </p>
              }
            >
              <RetourPaiement />
            </Suspense>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

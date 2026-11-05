import type { Metadata } from "next";

import { Footer } from "@/components/layout/Footer";
import { ReprendrePaiement } from "@/components/paiement/ReprendrePaiement";

/**
 * `/paiement/reprendre` — régler son reste plus tard.
 *
 * Le visiteur s'est inscrit avec un acompte puis a fermé l'onglet sans
 * solder : il donne l'e-mail de son inscription, voit chaque reste à
 * payer retrouvé sur cet appareil, et paie comme la première fois.
 *
 * Pas de navbar : elle porte un « Réserver ma place » qui n'a rien à
 * faire devant quelqu'un qui vient payer son solde.
 */

export const metadata: Metadata = {
  title: "Reprendre mon paiement — AIdevsprint #1",
  robots: { index: false, follow: false },
};

export default function PagePaiementReprendre() {
  return (
    <>
      <main
        id="top"
        className="flex flex-1 items-center justify-center
                   py-[clamp(4rem,14svh,9rem)]"
      >
        <div className="shell flex justify-center">
          <div className="w-full max-w-[42rem]">
            <ReprendrePaiement />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

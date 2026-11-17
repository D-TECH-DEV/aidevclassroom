"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  arreteDefilement,
  repartDefilement,
} from "@/components/motion/defilement";
import { ReprendrePaiement } from "@/components/paiement/ReprendrePaiement";
import { notifyInscriptionMaj } from "@/lib/usePlacesSprint";

const ContexteReprendrePaiement = createContext<(() => void) | null>(null);

/** Ouvre la modale de complétion d'inscription. `null` hors du fournisseur. */
export function useOuvrirReprendrePaiement() {
  return useContext(ContexteReprendrePaiement);
}

/**
 * Modale « Compléter mon inscription » : permet de régler son solde ou de
 * retrouver son dossier sans quitter la landing page.
 */
export function ModaleReprendrePaiement({ children }: { children: ReactNode }) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const [ouverte, setOuverte] = useState(false);

  const ouvre = useCallback(() => {
    setOuverte(true);
  }, []);

  useEffect(() => {
    if (!ouverte) return;

    arreteDefilement();
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOuverte(false);
        notifyInscriptionMaj();
      }
    };
    window.addEventListener("keydown", surTouche);

    return () => {
      window.removeEventListener("keydown", surTouche);
      repartDefilement();
    };
  }, [ouverte]);

  const fermer = useCallback(() => {
    setOuverte(false);
    notifyInscriptionMaj();
  }, []);

  return (
    <ContexteReprendrePaiement.Provider value={ouvre}>
      {children}

      {ouverte && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-reprendre-paiement"
          data-lenis-prevent
          onClick={(e) => {
            if (e.target === e.currentTarget) fermer();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
        >
          <div
            className="w-full max-w-[36rem]
                       max-h-[min(90svh,50rem)] overflow-y-auto
                       rounded-card border border-fg/15 bg-bg text-fg shadow-2xl"
          >
            <div className="p-[clamp(1.25rem,4vw,2.25rem)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-small text-[#6BA3FF]">
                    <span aria-hidden className="select-none">
                      {"// "}
                    </span>
                    compléter mon inscription
                  </p>
                  <h2
                    id="titre-reprendre-paiement"
                    className="mt-2 text-h3 font-bold leading-tight tracking-tight"
                  >
                    Finalise ton inscription.
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={fermer}
                  aria-label="Fermer"
                  className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center
                           rounded-pill text-fg/60 transition-colors
                           duration-[160ms] hoverable:hover:text-fg
                           active:scale-[0.92]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden
                    className="size-5 stroke-current"
                    fill="none"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="mt-[clamp(1.25rem,3svh,2rem)]">
                <ReprendrePaiement onFermer={fermer} />
              </div>
            </div>
          </div>
        </div>
      )}
    </ContexteReprendrePaiement.Provider>
  );
}

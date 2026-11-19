"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const EVENEMENT_MAJ = "aidev:inscription-maj";

type CompteurApi = {
  enrolledCount?: number;
  enrolledSeats?: number;
  capacity?: number | null;
};

/**
 * Demande aux jauges de places montées sur la page de se rafraîchir depuis
 * `/api/sprints/:id/enrolled-count` après une inscription ou fermeture de modale.
 */
export function notifyInscriptionMaj() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENEMENT_MAJ));
  }
}

/**
 * Synchronise le compteur `inscrits / quota` côté client afin d'éviter le délai
 * du cache ISR entre deux revalidations serveur.
 */
export function usePlacesSprint(
  sprintId: number | null | undefined,
  inscritsInitial: number | null,
  quotaInitial: number | null,
) {
  const [etat, setEtat] = useState({
    inscrits: inscritsInitial,
    quota: quotaInitial,
  });

  useEffect(() => {
    setEtat({ inscrits: inscritsInitial, quota: quotaInitial });
  }, [inscritsInitial, quotaInitial]);

  useEffect(() => {
    if (!sprintId) return;

    let actif = true;

    async function rafraichir() {
      try {
        const res = await api<CompteurApi>(
          `/sprints/${sprintId}/enrolled-count`,
          { cache: "no-store" },
        );
        if (!actif) return;
        const nextInscrits =
          typeof res.enrolledSeats === "number"
            ? res.enrolledSeats
            : typeof res.enrolledCount === "number"
              ? res.enrolledCount
              : inscritsInitial;
        const nextQuota =
          res.capacity !== undefined ? res.capacity : quotaInitial;
        setEtat({ inscrits: nextInscrits, quota: nextQuota });
      } catch {
        // En cas de panne passagère, on conserve les valeurs SSR initiales.
      }
    }

    void rafraichir();

    const surMaj = () => {
      void rafraichir();
    };
    window.addEventListener(EVENEMENT_MAJ, surMaj);
    return () => {
      actif = false;
      window.removeEventListener(EVENEMENT_MAJ, surMaj);
    };
  }, [sprintId, inscritsInitial, quotaInitial]);

  return etat;
}

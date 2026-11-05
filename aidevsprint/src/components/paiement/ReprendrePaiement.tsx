"use client";

import { useEffect, useState } from "react";

import { ErreurApi } from "@/lib/api";
import {
  adressePaiementValide,
  dossiersLocaux,
  lancePaiement,
  rangeTrace,
  SECOURS_WHATSAPP,
  statutInscription,
  traduitPaiement,
  type DossierLocal,
  type DossierSuivi,
} from "@/lib/paiement";

/**
 * « Reprendre mon paiement », `/paiement/reprendre`.
 *
 * Le parcours d'après, en un clic : la page retrouve toute seule les
 * dossiers ouverts sur cet appareil, affiche chaque reste à payer, et
 * chacun se paie comme avant — même `initialize`, même redirection
 * Paystack, même page de retour. Pas de formulaire, pas d'e-mail à
 * retaper : un bouton y mène, le reste s'affiche, on paie.
 *
 * ── Limite assumée ─────────────────────────────────────────────────
 * On ne montre que les dossiers ouverts sur cet appareil : le jeton de
 * suivi ne sort jamais du navigateur où l'inscription a eu lieu (voir
 * `src/lib/paiement.ts`). Un dossier d'un autre appareil reste
 * invisible — et dans ce cas on le dit avec le repli WhatsApp plutôt
 * qu'un vide qui accuserait le visiteur.
 */

type DossierAffiche = {
  local: DossierLocal;
  suivi?: DossierSuivi;
  erreur?: string;
};

type Etat =
  | { phase: "recherche" }
  | { phase: "vide" }
  | { phase: "liste"; dossiers: DossierAffiche[] };

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-[clamp(0.75rem,2svh,1.25rem)]
                 rounded-card border border-fg/15 bg-surface text-center
                 px-[clamp(1.5rem,5vw,3.5rem)]
                 py-[clamp(2rem,6svh,3.5rem)]"
    >
      {children}
    </div>
  );
}

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-h2 font-bold leading-[1.1] tracking-tight">
      {children}
    </h1>
  );
}

function Texte({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-fg/70">{children}</p>;
}

export function ReprendrePaiement() {
  const [etat, setEtat] = useState<Etat>({ phase: "recherche" });
  // Un paiement en cours par dossier : deux lignes n'attendent jamais
  // ensemble, chacune porte son propre état.
  const [enCours, setEnCours] = useState<Record<number, boolean>>({});
  const [erreurs, setErreurs] = useState<Record<number, string>>({});

  // Chargement direct à l'ouverture : aucun e-mail à saisir, les
  // dossiers connus de ce navigateur remontent tout seuls.
  useEffect(() => {
    let annule = false;

    (async () => {
      const locaux = dossiersLocaux();
      if (locaux.length === 0) {
        if (!annule) setEtat({ phase: "vide" });
        return;
      }

      const affiches = await Promise.all(
        locaux.map(async (local): Promise<DossierAffiche> => {
          try {
            const suivi = await statutInscription(
              local.idInscription,
              local.jeton,
            );
            return { local, suivi };
          } catch (cause) {
            return {
              local,
              erreur:
                cause instanceof ErreurApi &&
                cause.code === "ENROLLMENT_NOT_FOUND"
                  ? "Ce dossier n'existe plus côté serveur."
                  : traduitPaiement(cause),
            };
          }
        }),
      );
      if (!annule) setEtat({ phase: "liste", dossiers: affiches });
    })();

    return () => {
      annule = true;
    };
  }, []);

  async function paieReste(dossier: DossierAffiche) {
    const reste = dossier.suivi?.remainingAmountXof;
    if (
      reste === undefined ||
      reste <= 0 ||
      enCours[dossier.local.idInscription]
    ) {
      return;
    }

    setEnCours((v) => ({ ...v, [dossier.local.idInscription]: true }));
    setErreurs((v) => {
      const suivantes = { ...v };
      delete suivantes[dossier.local.idInscription];
      return suivantes;
    });

    try {
      const lance = await lancePaiement(
        dossier.local.idInscription,
        reste,
        dossier.local.jeton,
      );

      if (!adressePaiementValide(lance.authorizationUrl)) {
        throw new Error(
          `adresse de paiement inattendue : ${lance.authorizationUrl}`,
        );
      }

      rangeTrace(lance.reference, {
        idInscription: dossier.local.idInscription,
        jeton: dossier.local.jeton,
        prenom: dossier.local.prenom ?? "",
        montantXof: reste,
        email: dossier.local.email,
      });

      window.location.href = lance.authorizationUrl;
    } catch (cause) {
      setEnCours((v) => ({ ...v, [dossier.local.idInscription]: false }));
      setErreurs((v) => ({
        ...v,
        [dossier.local.idInscription]: traduitPaiement(cause),
      }));
    }
  }

  if (etat.phase === "recherche") {
    return (
      <Cadre>
        <Titre>On cherche tes dossiers…</Titre>
        <Texte>Quelques secondes.</Texte>
      </Cadre>
    );
  }

  if (etat.phase === "vide") {
    return (
      <Cadre>
        <Titre>Aucun dossier sur cet appareil.</Titre>
        <Texte>
          Les inscriptions faites ici s&apos;y retrouvent toutes seules —
          mais la clé d&apos;un dossier ne voyage pas : navigation privée,
          autre téléphone, stockage vidé, et ce navigateur ne connaît rien.
        </Texte>
        <Texte>
          Donne-nous ton e-mail et on retrouve ton reste à payer à la main.{" "}
          {SECOURS_WHATSAPP}
        </Texte>
      </Cadre>
    );
  }

  return (
    <div className="flex flex-col gap-[clamp(1rem,2.5svh,1.5rem)]">
      <Titre>Mon reste à payer.</Titre>
      {etat.dossiers.map((dossier) => (
        <LigneDossier
          key={dossier.local.idInscription}
          dossier={dossier}
          occupe={enCours[dossier.local.idInscription] ?? false}
          erreur={erreurs[dossier.local.idInscription]}
          onPaie={() => void paieReste(dossier)}
        />
      ))}
    </div>
  );
}

function LigneDossier({
  dossier,
  occupe,
  erreur,
  onPaie,
}: {
  dossier: DossierAffiche;
  occupe: boolean;
  erreur?: string;
  onPaie: () => void;
}) {
  const { suivi } = dossier;

  if (!suivi) {
    return (
      <div
        className="rounded-card border border-fg/15 bg-surface
                   px-[clamp(1.25rem,3vw,2rem)] py-[clamp(1.25rem,3svh,2rem)]
                   text-left"
      >
        <p className="font-mono text-small text-fg/60">
          Dossier n°{dossier.local.idInscription}
        </p>
        <p role="alert" className="mt-2 text-body text-fg/80">
          {dossier.erreur ?? "Dossier illisible."}
        </p>
      </div>
    );
  }

  const reste = suivi.remainingAmountXof ?? 0;
  const solde = reste <= 0;

  return (
    <div
      className={`rounded-card border bg-surface text-left
                  px-[clamp(1.25rem,3vw,2rem)] py-[clamp(1.25rem,3svh,2rem)]
                  ${solde ? "border-accent/60" : "border-fg/15"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-h3 font-bold leading-tight tracking-tight">
          {suivi.sprint?.name ?? `Dossier n°${suivi.id}`}
        </p>
        <p className="font-mono text-small text-fg/50">
          {suivi.totalPaidXof?.toLocaleString("fr-FR") ?? 0} /{" "}
          {suivi.totalAmountXof.toLocaleString("fr-FR")} FCFA payés
        </p>
      </div>

      {suivi.status === "CANCELLED" ? (
        <p className="mt-3 text-body text-fg/70">
          Cette inscription a été annulée : aucun versement possible.{" "}
          {SECOURS_WHATSAPP}
        </p>
      ) : solde ? (
        <p className="mt-3 text-body text-fg/70">
          C&apos;est réglé, ta place est confirmée. On te retrouve le jour J.
        </p>
      ) : (
        <>
          <p className="mt-3 text-body">
            Reste à payer :{" "}
            <strong>{reste.toLocaleString("fr-FR")} FCFA</strong>
          </p>
          <button
            type="button"
            onClick={onPaie}
            disabled={occupe}
            className="mt-4 inline-flex w-full items-center justify-center
                       rounded-pill border-2 border-cta px-10
                       py-[clamp(0.75rem,2.4svh,1.375rem)] text-body font-bold
                       transition-transform duration-[120ms] active:scale-[0.96]
                       disabled:cursor-not-allowed disabled:opacity-60"
          >
            {occupe
              ? "Ouverture du paiement…"
              : `Payer le reste — ${reste.toLocaleString("fr-FR")} FCFA`}
          </button>
          {erreur ? (
            <p role="alert" className="mt-3 text-small font-medium text-fg">
              {erreur}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

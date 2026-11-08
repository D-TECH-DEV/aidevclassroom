"use client";

import { useEffect, useState } from "react";

import { ErreurApi } from "@/lib/api";
import {
  adressePaiementValide,
  dossiersLocaux,
  lancePaiement,
  rangeTrace,
  retrouveDossiersParEmail,
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
 * ── D'où viennent les dossiers ──────────────────────────────────────
 * Ceux ouverts sur cet appareil remontent tout seuls (`localStorage`).
 * Un dossier d'un autre appareil se retrouve avec son e-mail : l'API
 * re-emet alors un jeton pour ce navigateur (voir `src/lib/paiement.ts`).
 * Le repli WhatsApp reste pour les cas sans e-mail.
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
  // Recherche par e-mail : pour un autre appareil que celui d'inscription.
  const [email, setEmail] = useState("");
  const [rechercheEmail, setRechercheEmail] = useState(false);
  const [erreurEmail, setErreurEmail] = useState<string | null>(null);
  const [retrouves, setRetrouves] = useState<number | null>(null);

  // Relit les dossiers connus de ce navigateur et leur reste à payer.
  async function charge(): Promise<Etat> {
    const locaux = dossiersLocaux();
    if (locaux.length === 0) return { phase: "vide" };

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
    return { phase: "liste", dossiers: affiches };
  }

  // Chargement direct à l'ouverture : aucun e-mail à saisir, les
  // dossiers connus de ce navigateur remontent tout seuls.
  useEffect(() => {
    let annule = false;
    void charge().then((suivant) => {
      if (!annule) setEtat(suivant);
    });
    return () => {
      annule = true;
    };
  }, []);

  // Un autre téléphone, un autre navigateur : l'e-mail retrouve les
  // dossiers et range leurs jetons ici, qui devient capable de payer.
  async function recupereParEmail(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (rechercheEmail) return;
    const propre = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(propre)) {
      setErreurEmail("Cette adresse e-mail n'est pas valide.");
      return;
    }
    setRechercheEmail(true);
    setErreurEmail(null);
    setRetrouves(null);
    try {
      const dossiers = await retrouveDossiersParEmail(propre);
      setRetrouves(dossiers.length);
      if (dossiers.length === 0) {
        setErreurEmail(
          "Aucun dossier pour cette adresse. Vérifie l'e-mail de ton inscription.",
        );
      }
      setEtat(await charge());
    } catch (cause) {
      setErreurEmail(traduitPaiement(cause));
    } finally {
      setRechercheEmail(false);
    }
  }

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

  // Le formulaire e-mail : la porte d'entrée depuis un autre appareil.
  // Même carte que le reste, pour ne pas faire deux pages en une.
  function BlocEmail() {
    return (
      <form
        onSubmit={(e) => void recupereParEmail(e)}
        className="rounded-card border border-fg/15 bg-surface
                   px-[clamp(1.25rem,3vw,2rem)] py-[clamp(1.25rem,3svh,2rem)]
                   text-left"
      >
        <p className="text-h3 font-bold leading-tight tracking-tight">
          Un autre téléphone ?
        </p>
        <p className="mt-2 text-body text-fg/70">
          Saisis l&apos;e-mail de ton inscription : on retrouve ton reste à
          payer ici même, et tu paies comme avant.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@email.com"
            autoComplete="email"
            aria-label="E-mail de ton inscription"
            className="w-full rounded-field border border-fg/20 bg-bg
                       px-4 py-3 text-body text-fg outline-none
                       placeholder:text-fg/35 focus-visible:border-accent/60"
          />
          <button
            type="submit"
            disabled={rechercheEmail}
            className="inline-flex shrink-0 items-center justify-center
                       rounded-pill border-2 border-cta px-8 py-3
                       text-body font-bold transition-transform
                       duration-[120ms] active:scale-[0.96]
                       disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rechercheEmail ? "Recherche…" : "Retrouver"}
          </button>
        </div>
        {erreurEmail ? (
          <p role="alert" className="mt-3 text-small font-medium text-fg">
            {erreurEmail}
          </p>
        ) : null}
        {retrouves !== null && !erreurEmail ? (
          <p role="status" className="mt-3 text-small text-fg/70">
            {retrouves === 0
              ? "Aucun dossier retrouvé."
              : `${retrouves} dossier${retrouves > 1 ? "s" : ""} retrouvé${retrouves > 1 ? "s" : ""} : paie juste en dessous.`}
          </p>
        ) : null}
      </form>
    );
  }

  if (etat.phase === "vide") {
    return (
      <div className="flex flex-col gap-[clamp(1rem,2.5svh,1.5rem)]">
        <Cadre>
          <Titre>Aucun dossier sur cet appareil.</Titre>
          <Texte>
            Les inscriptions faites ici s&apos;y retrouvent toutes seules —
            mais la clé d&apos;un dossier ne voyage pas : navigation privée,
            autre téléphone, stockage vidé, et ce navigateur ne connaît rien.
          </Texte>
          <Texte>
            Pas de panique : ton inscription est gardée côté serveur.{" "}
            {SECOURS_WHATSAPP}
          </Texte>
        </Cadre>
        <BlocEmail />
      </div>
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
      <BlocEmail />
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
        {suivi.plan === "DUO" ? (
          <p className="font-mono text-small text-fg/50">
            Forfait duo
            {suivi.partnerFirstName || suivi.partnerLastName
              ? ` · avec ${[suivi.partnerFirstName, suivi.partnerLastName].filter(Boolean).join(" ")}`
              : ""}
          </p>
        ) : null}
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

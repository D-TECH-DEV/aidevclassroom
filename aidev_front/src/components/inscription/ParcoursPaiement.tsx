"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Champ,
  normaliseTelephone,
} from "@/components/inscription/FormulaireInscription";
import { CtaButton } from "@/components/ui/CtaButton";
import {
  FENETRE_CHARGE_MS,
  INTERVALLE_VERIF_CHARGE_MS,
  OPERATEURS_MOBILES,
  SECOURS_WHATSAPP,
  adressePaiementValide,
  classeStatutCharge,
  derniereCharge,
  effaceDerniereCharge,
  initieChargeMobile,
  rangeCharge,
  rangeTrace,
  statutInscription,
  telephoneChargeStrict,
  traduitPaiement,
  verifiePaiement,
  type DossierSuivi,
  type OperateurMobile,
  type PaiementVerifie,
  type TraceCharge,
} from "@/lib/paiement";

/**
 * Le parcours de paiement mobile money dans la modale (étapes 2 à 6).
 *
 * E1 (l'inscription) vit dans `FormulaireInscription` et ne change pas.
 * Ici, même modale (`<dialog>` de `ModaleInscription`), mêmes classes,
 * mêmes transitions — seul le contenu du panneau avance :
 *
 * E2 moyen : radios MTN / Orange / Wave (jamais de carte) + récapitulatif
 *   et montants déterminés automatiquement (minimum pour réserver,
 *   reste à payer pour tout régler).
 * E3 téléphone : numéro ivoirien strict + initiation (`POST initialize`
 *   `{ amountXof, provider, phone }`), bouton désactivé et
 *   anti-double-clic.
 * E4 consigne : `display_text` (« validez sur votre téléphone »),
 *   compte à rebours 180 s, vérification bornée du statut
 *   (`GET /payments/:reference/verify`) + re-vérification au retour
 *   sur l'onglet et sur demande.
 * E5 états : pending / success / failed dans la même modale — mêmes
 *   messages et même vérification que `ReprendrePaiement` /
 *   `RetourPaiement` (voir `traduitPaiement`, `verifiePaiement`).
 * E6 reçu : solde via `statutInscription` (total payé, reste).
 *
 * `Précédent` conserve tout ce qui a été saisi (opérateur, montant,
 * téléphone). La charge (référence + montant + opérateur) est rangée en
 * `localStorage` : fermer la modale ne la perd pas, et la reprise se fait
 * ici même ou depuis « reprendre mon paiement ». Jamais de PIN, d'OTP ou
 * de code collecté dans notre interface.
 */

export type DossierAPayer = {
  idInscription: number;
  jeton: string;
  prenom: string;
  email?: string;
  totalXof: number;
  minimumXof: number;
  forfait?: "SINGLE" | "DUO";
  binome?: string;
  /** Quand le dossier vient d'une reprise : un seul montant possible. */
  resteXof?: number;
  /** Le numéro saisi à l'inscription, pour pré-remplir l'étape téléphone. */
  telephonePrefill?: string;
};

type Etape = "moyen" | "telephone" | "validation" | "termine";

type ChargeEnCours = TraceCharge & {
  reference: string;
  displayText: string | null;
};

type Resultat = {
  paiement: PaiementVerifie;
  /** Vrai quand les 180 s se sont écoulées sans statut final. */
  delaiDepasse: boolean;
};

const WHATSAPP_AFFICHE = "07 04 92 10 80";

function formatDuree(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  return `${minutes}:${String(reste).padStart(2, "0")}`;
}

function BoutonSecondaire({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center rounded-pill
                 border border-fg/20 px-10 py-[clamp(0.75rem,2.4svh,1.375rem)]
                 text-body font-bold transition-colors duration-[160ms]
                 hoverable:hover:border-accent active:scale-[0.96]
                 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function Navigation({
  onPrecedent,
  precedentLabel = "Précédent",
  suivant,
}: {
  onPrecedent: () => void;
  precedentLabel?: string;
  suivant: React.ReactNode;
}) {
  return (
    <div className="mt-[clamp(0.25rem,1svh,0.75rem)] grid gap-3 sm:grid-cols-2">
      <BoutonSecondaire onClick={onPrecedent}>
        ← {precedentLabel}
      </BoutonSecondaire>
      {suivant}
    </div>
  );
}

export function ParcoursPaiement({
  dossier,
  onPrecedent,
}: {
  dossier: DossierAPayer;
  /** E2 ← : retour au formulaire, données conservées. */
  onPrecedent: () => void;
}) {
  // Montants déterminés automatiquement à l'arrivée sur l'étape :
  // le reste à payer (le total pour une inscription neuve), avec le
  // minimum du dashboard pour réserver sa place. Fini les 30 %.
  const montantUnique = dossier.resteXof ?? dossier.totalXof;

  const [etape, setEtape] = useState<Etape>("moyen");
  const [operateur, setOperateur] = useState<OperateurMobile | null>(null);
  const [montant, setMontant] = useState<number>(montantUnique);
  const [telephone, setTelephone] = useState(dossier.telephonePrefill ?? "");
  const [erreurTelephone, setErreurTelephone] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [charge, setCharge] = useState<ChargeEnCours | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [recu, setRecu] = useState<DossierSuivi | null>(null);
  const [recuErreur, setRecuErreur] = useState(false);
  // Une charge lancée avant fermeture de la modale : proposée en E2.
  const [chargeStockee, setChargeStockee] = useState<{
    reference: string;
    trace: TraceCharge;
  } | null>(null);

  useEffect(() => {
    setChargeStockee(derniereCharge(dossier.idInscription));
  }, [dossier.idInscription]);

  const montantAffiche = (montant ?? 0).toLocaleString("fr-FR");
  const numeroEtape = etape === "moyen" ? 2 : etape === "telephone" ? 3 : 4;

  /** E3 → E4 : demande le débit du numéro, une seule fois. */
  async function envoieCharge() {
    // Anti-double-clic : le bouton est désactivé pendant l'envoi et toute
    // rentrée ici repart sans rien faire.
    if (envoi || !operateur) return;

    const normalise = normaliseTelephone(telephone);
    // Le back n'accepte que l'E.164 ivoirien strict (`225` + 10 chiffres,
    // sans `+`) : tout le reste est refusé avant l'envoi.
    const strict = normalise === null ? null : telephoneChargeStrict(normalise);
    if (strict === null) {
      setErreurTelephone(
        telephone.trim()
          ? "Ce parcours accepte uniquement les numéros ivoiriens : dix chiffres, on ajoute le +225."
          : "Le numéro à débiter est obligatoire.",
      );
      return;
    }
    setErreurTelephone(null);
    setEnvoi(true);
    setErreur(null);

    try {
      const lancee = await initieChargeMobile(
        dossier.idInscription,
        montant,
        dossier.jeton,
        operateur,
        strict,
      );

      // Repli automatique : charge désactivée côté serveur, le back rend
      // une adresse checkout — on redirige comme l'ancien parcours au
      // lieu d'attendre ici.
      if (
        lancee.authorizationUrl &&
        adressePaiementValide(lancee.authorizationUrl)
      ) {
        rangeTrace(lancee.reference, {
          idInscription: dossier.idInscription,
          jeton: dossier.jeton,
          prenom: dossier.prenom,
          montantXof: montant,
          email: dossier.email,
        });
        window.location.href = lancee.authorizationUrl;
        return;
      }

      const trace: TraceCharge = {
        idInscription: dossier.idInscription,
        jeton: dossier.jeton,
        prenom: dossier.prenom,
        montantXof: montant,
        email: dossier.email,
        operateur,
        telephone: strict,
        initieeA: Date.now(),
      };
      // La charge rangée (référence + montant + opérateur) survit à la
      // fermeture. La trace historique garde le dossier découvrable par
      // « reprendre mon paiement » et la page de retour.
      rangeCharge(lancee.reference, trace);
      rangeTrace(lancee.reference, {
        idInscription: dossier.idInscription,
        jeton: dossier.jeton,
        prenom: dossier.prenom,
        montantXof: montant,
        email: dossier.email,
      });

      setCharge({ ...trace, reference: lancee.reference, displayText: lancee.displayText ?? null });
      setChargeStockee(null);
      setResultat(null);
      setEtape("validation");
    } catch (cause) {
      setErreur(traduitPaiement(cause));
    } finally {
      setEnvoi(false);
    }
  }

  /** Quitte E4 vers le suivi d'une charge lancée avant fermeture. */
  function reprendChargeStockee() {
    if (!chargeStockee) return;
    setCharge({
      ...chargeStockee.trace,
      reference: chargeStockee.reference,
      displayText: null,
    });
    setOperateur(chargeStockee.trace.operateur);
    setMontant(chargeStockee.trace.montantXof);
    setResultat(null);
    setEtape("validation");
  }

  const memoriseResultat = useCallback(
    (paiement: PaiementVerifie, delaiDepasse: boolean) => {
      setResultat({ paiement, delaiDepasse });
      // Statut final (ou fenêtre dépassée) : la « dernière charge » n'a
      // plus à être proposée en E2.
      effaceDerniereCharge(dossier.idInscription);
      setEtape("termine");
      if (classeStatutCharge(paiement.status) === "succes") {
        // E6 : le reçu et le solde, lus sur le dossier (font foi).
        setRecu(null);
        setRecuErreur(false);
        void statutInscription(dossier.idInscription, dossier.jeton).then(
          (suivi) => setRecu(suivi),
          () => setRecuErreur(true),
        );
      }
    },
    [dossier.idInscription, dossier.jeton],
  );

  const verifieManuelRef = useRef<(() => void) | null>(null);

  // E4 : vérification bornée du statut — première passe après un court
  // délai, puis toutes les 5 s jusqu'à la fin de la fenêtre de 180 s.
  // Écoute retour : re-vérifie quand l'onglet redevient visible
  // (l'utilisateur valide sur son téléphone puis revient ici).
  useEffect(() => {
    if (etape !== "validation" || !charge) return;
    let annule = false;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const debut = charge.initieeA;
    const reference = charge.reference;

    const interroge = async (manuelle: boolean) => {
      let paiement: PaiementVerifie;
      try {
        paiement = await verifiePaiement(reference, dossier.jeton);
      } catch (cause) {
        if (annule) return;
        // En automatique, une erreur réseau ne casse pas l'attente : on
        // réessaie au prochain tour. En manuel, on l'affiche.
        if (manuelle) setErreur(traduitPaiement(cause));
        minuteur = setTimeout(
          () => void interroge(false),
          INTERVALLE_VERIF_CHARGE_MS,
        );
        return;
      }
      if (annule) return;
      const issue = classeStatutCharge(paiement.status);
      const expire = Date.now() - debut >= FENETRE_CHARGE_MS;
      if (issue !== "attente" || expire) {
        memoriseResultat(paiement, expire && issue === "attente");
      } else {
        minuteur = setTimeout(
          () => void interroge(false),
          INTERVALLE_VERIF_CHARGE_MS,
        );
      }
    };

    minuteur = setTimeout(() => void interroge(false), 2000);
    verifieManuelRef.current = () => {
      if (minuteur) clearTimeout(minuteur);
      setErreur(null);
      void interroge(true);
    };
    const auRetourVisible = () => {
      if (document.visibilityState === "visible") {
        if (minuteur) clearTimeout(minuteur);
        void interroge(false);
      }
    };
    document.addEventListener("visibilitychange", auRetourVisible);
    window.addEventListener("focus", auRetourVisible);
    return () => {
      annule = true;
      if (minuteur) clearTimeout(minuteur);
      document.removeEventListener("visibilitychange", auRetourVisible);
      window.removeEventListener("focus", auRetourVisible);
    };
  }, [etape, charge?.reference, dossier.jeton, memoriseResultat]);

  // Le compte à rebours de la fenêtre de 180 s.
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (etape !== "validation") return;
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, [etape]);
  const secondesRestantes = charge
    ? Math.max(
        0,
        Math.ceil((FENETRE_CHARGE_MS - (maintenant - charge.initieeA)) / 1000),
      )
    : 0;

  /** Après le délai : re-vérifie une fois, sans rouvrir de fenêtre. */
  async function reverifieApresDelai() {
    if (!charge || etape !== "termine") return;
    setErreur(null);
    try {
      const paiement = await verifiePaiement(charge.reference, dossier.jeton);
      memoriseResultat(
        paiement,
        classeStatutCharge(paiement.status) === "attente",
      );
    } catch (cause) {
      setErreur(traduitPaiement(cause));
    }
  }

  if (etape === "moyen") {
    return (
      <div className="flex flex-col gap-[clamp(1rem,2.5svh,1.5rem)]">
        <p className="font-mono text-small text-accent">
          <span aria-hidden className="select-none">
            {"// "}
          </span>
          paiement · étape 2 sur 6
        </p>

        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-card border border-accent/60
                     px-[clamp(1.25rem,3vw,2rem)]
                     py-[clamp(1.5rem,4svh,2.5rem)] text-center"
        >
          <p className="text-h3 font-bold leading-tight">
            C&apos;est noté, {dossier.prenom}.
          </p>
          <p className="text-body text-fg/70">
            {dossier.forfait === "DUO" ? (
              <>
                Deux places retenues
                {dossier.binome ? ` — avec ${dossier.binome}` : ""}. Elles
                sont confirmées une fois les{" "}
                {dossier.totalXof.toLocaleString("fr-FR")} FCFA réglés.
              </>
            ) : (
              <>
                Ta place est retenue. Elle est confirmée une fois les{" "}
                {dossier.totalXof.toLocaleString("fr-FR")} FCFA réglés.
              </>
            )}
          </p>
        </div>

        {/* Une demande est peut-être déjà partie avant fermeture : on la
            propose plutôt que d'en lancer une seconde. */}
        {chargeStockee ? (
          <div
            role="status"
            className="rounded-card border border-fg/15 bg-surface
                       px-[clamp(0.875rem,2vw,1.125rem)]
                       py-[clamp(0.6875rem,1.6svh,0.9375rem)] text-left"
          >
            <p className="text-body">
              Une demande de{" "}
              <strong>
                {chargeStockee.trace.montantXof.toLocaleString("fr-FR")} FCFA
              </strong>{" "}
              via {chargeStockee.trace.operateur === "mtn" ? "MTN" : chargeStockee.trace.operateur === "orange" ? "Orange" : "Wave"}{" "}
              est déjà en cours (réf.{" "}
              <span className="font-mono text-small">
                {chargeStockee.reference}
              </span>
              ).
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <BoutonSecondaire onClick={reprendChargeStockee}>
                Voir le statut
              </BoutonSecondaire>
              <BoutonSecondaire
                onClick={() => {
                  effaceDerniereCharge(dossier.idInscription);
                  setChargeStockee(null);
                }}
              >
                Recommencer
              </BoutonSecondaire>
            </div>
          </div>
        ) : null}

        {/* Le moyen : mobile money uniquement. Pas de carte, par décision
            produit — aucun champ PAN/CVV/PIN n'existe dans ce parcours. */}
        <fieldset>
          <legend className="font-mono text-small uppercase tracking-[0.15em] text-fg/60">
            Moyen de paiement
          </legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Opérateur mobile money">
            {OPERATEURS_MOBILES.map((option) => (
              <button
                key={option.code}
                type="button"
                role="radio"
                aria-checked={operateur === option.code}
                onClick={() => setOperateur(option.code)}
                className={`rounded-card border px-4 py-3 text-left transition-colors duration-[160ms] ${
                  operateur === option.code
                    ? "border-accent/60 bg-surface"
                    : "border-fg/15"
                }`}
              >
                <span className="block text-body font-bold">{option.nom}</span>
                <span className="mt-1 block font-mono text-small text-fg/60">
                  {option.detail}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Les montants : déterminés automatiquement à l'arrivée sur
            l'étape — le minimum du dashboard pour réserver sa place, ou
            le reste à payer. Aucune étape supplémentaire. */}
        {dossier.resteXof !== undefined ? (
          <p className="text-body">
            Reste à payer :{" "}
            <strong>{dossier.resteXof.toLocaleString("fr-FR")} FCFA</strong>{" "}
            <span className="text-fg/55">
              (sur {dossier.totalXof.toLocaleString("fr-FR")})
            </span>
          </p>
        ) : (
          <>
            <p className="text-body">
              À régler :{" "}
              <strong>
                {montantUnique.toLocaleString("fr-FR")} FCFA
              </strong>
            </p>
            {dossier.minimumXof < montantUnique ? (
              <fieldset>
                <legend className="font-mono text-small uppercase tracking-[0.15em] text-fg/60">
                  Montant
                </legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Montant à payer">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={montant === dossier.minimumXof}
                    onClick={() => setMontant(dossier.minimumXof)}
                    className={`rounded-card border px-4 py-3 text-left transition-colors duration-[160ms] ${
                      montant === dossier.minimumXof
                        ? "border-accent/60 bg-surface"
                        : "border-fg/15"
                    }`}
                  >
                    <span className="block text-body font-bold">Réserver ma place</span>
                    <span className="mt-1 block font-mono text-small text-fg/60">
                      {dossier.minimumXof.toLocaleString("fr-FR")} FCFA
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={montant === montantUnique}
                    onClick={() => setMontant(montantUnique)}
                    className={`rounded-card border px-4 py-3 text-left transition-colors duration-[160ms] ${
                      montant === montantUnique
                        ? "border-accent/60 bg-surface"
                        : "border-fg/15"
                    }`}
                  >
                    <span className="block text-body font-bold">Tout payer</span>
                    <span className="mt-1 block font-mono text-small text-fg/60">
                      {montantUnique.toLocaleString("fr-FR")} FCFA
                    </span>
                  </button>
                </div>
              </fieldset>
            ) : null}
          </>
        )}

        {erreur && (
          <p role="alert" className="text-small font-medium text-fg">
            {erreur}
          </p>
        )}

        <Navigation
          onPrecedent={onPrecedent}
          suivant={
            <CtaButton
              type="button"
              onClick={() => {
                if (operateur) {
                  setErreur(null);
                  setEtape("telephone");
                }
              }}
              disabled={!operateur}
              pleineLargeur
            >
              {`Suivant — ${montantAffiche} FCFA`}
            </CtaButton>
          }
        />

        <p className="text-small text-fg/45">
          Paiement mobile money. Le reste se règle plus tard, depuis la{" "}
          <a
            href="/paiement/reprendre"
            className="underline decoration-fg/25 underline-offset-4"
          >
            page « reprendre mon paiement »
          </a>
          . Un souci ? Écris-nous sur WhatsApp au {WHATSAPP_AFFICHE}.
        </p>
      </div>
    );
  }

  const nomOperateur =
    operateur === "mtn" ? "MTN" : operateur === "orange" ? "Orange" : "Wave";

  // E3 : le numéro à débiter, en E.164. On ne collecte rien d'autre :
  // ni PIN, ni OTP, ni code.
  if (etape === "telephone") {
    return (
      <div className="flex flex-col gap-[clamp(1rem,2.5svh,1.5rem)]">
        <p className="font-mono text-small text-accent">
          <span aria-hidden className="select-none">
            {"// "}
          </span>
          paiement · étape {numeroEtape} sur 6
        </p>

        <p className="text-h3 font-bold leading-tight">
          Ton numéro {operateur ? nomOperateur : ""}.
        </p>
        <p className="text-body text-fg/70">
          On envoie une demande de{" "}
          <strong>{montantAffiche} FCFA</strong>
          {operateur ? ` sur ton ${nomOperateur}` : ""}. Tu la valides sur
          ton téléphone, et c&apos;est réglé.
        </p>

        <Champ
          nom="telephone"
          etiquette="Numéro à débiter"
          aide="Dix chiffres suffisent, on ajoute le +225."
          valeur={telephone}
          onChange={(valeur) => {
            setTelephone(valeur);
            setErreurTelephone(null);
          }}
          erreur={erreurTelephone ?? undefined}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="07 04 92 10 80"
        />

        <p className="text-small text-fg/45">
          On ne te demandera jamais ton code PIN ici : il se saisit
          uniquement sur ton téléphone, dans ton application{" "}
          {operateur ? nomOperateur : "mobile money"}.
        </p>

        {erreur && (
          <p role="alert" className="text-small font-medium text-fg">
            {erreur}
          </p>
        )}

        <Navigation
          onPrecedent={() => {
            setErreur(null);
            setEtape("moyen");
          }}
          suivant={
            <CtaButton
              type="button"
              onClick={() => void envoieCharge()}
              disabled={envoi || !operateur}
              pleineLargeur
            >
              {envoi
                ? "Envoi de la demande…"
                : `Envoyer la demande — ${montantAffiche} FCFA`}
            </CtaButton>
          }
        />
      </div>
    );
  }

  // E4 : la consigne opérateur et l'attente bornée. Pas de « Précédent »
  // ici : la demande est partie, revenir en arrière ne l'annulerait pas
  // et un second envoi paierait deux fois.
  if (etape === "validation" && charge) {
    return (
      <div className="flex flex-col gap-[clamp(1rem,2.5svh,1.5rem)]">
        <p className="font-mono text-small text-accent">
          <span aria-hidden className="select-none">
            {"// "}
          </span>
          paiement · étape {numeroEtape} sur 6
        </p>

        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-card border border-accent/60
                     px-[clamp(1.25rem,3vw,2rem)]
                     py-[clamp(1.5rem,4svh,2.5rem)] text-center"
        >
          <p className="text-h3 font-bold leading-tight">
            {charge.displayText ?? "Validez sur votre téléphone."}
          </p>
          <p className="text-body text-fg/70">
            Confirme le paiement de{" "}
            <strong>
              {charge.montantXof.toLocaleString("fr-FR")} FCFA
            </strong>{" "}
            dans ton application{" "}
            {charge.operateur === "mtn"
              ? "MTN"
              : charge.operateur === "orange"
                ? "Orange"
                : "Wave"}{" "}
            ({charge.telephone}). On surveille la confirmation : ne ferme
            pas, ne repaie pas.
          </p>
          <p className="font-mono text-small text-fg/60" aria-live="polite">
            Temps restant : {formatDuree(secondesRestantes)}
          </p>
          <p className="font-mono text-small text-fg/45">
            Référence :{" "}
            <span className="select-all text-fg/70">{charge.reference}</span>
          </p>
        </div>

        {erreur && (
          <p role="alert" className="text-small font-medium text-fg">
            {erreur}
          </p>
        )}

        <CtaButton
          type="button"
          onClick={() => verifieManuelRef.current?.()}
          pleineLargeur
        >
          Vérifier maintenant
        </CtaButton>

        <p className="text-small text-fg/45">
          Tu as 3 minutes pour valider. Passé ce délai, on vérifie une
          dernière fois : si ça n&apos;est pas passé, rien n&apos;est débité.
          Un souci ? Écris-nous sur WhatsApp au {WHATSAPP_AFFICHE}.
        </p>
      </div>
    );
  }

  // E5 + E6 : l'issue dans la même modale, puis le reçu et le solde lus
  // sur le dossier. Mêmes messages que `RetourPaiement`.
  const paiement = resultat?.paiement ?? null;
  const issue = paiement ? classeStatutCharge(paiement.status) : "attente";
  const delaiDepasse = resultat?.delaiDepasse ?? false;
  const reste = paiement?.remainingAmountXof;
  const solde = reste === undefined || reste === 0;

  return (
    <div className="flex flex-col gap-[clamp(1rem,2.5svh,1.5rem)]">
      <p className="font-mono text-small text-accent">
        <span aria-hidden className="select-none">
          {"// "}
        </span>
        paiement · étape {issue === "succes" ? "6" : "5"} sur 6
      </p>

      <div
        role="status"
        className={`flex flex-col items-center gap-3 rounded-card border
                    px-[clamp(1.25rem,3vw,2rem)]
                    py-[clamp(1.5rem,4svh,2.5rem)] text-center
                    ${issue === "succes" ? "border-accent/60" : "border-fg/15"}`}
      >
        {issue === "succes" ? (
          <>
            <p className="text-h3 font-bold leading-tight">
              {solde
                ? `C'est réglé, ${dossier.prenom}.`
                : `Paiement reçu, ${dossier.prenom}.`}
            </p>
            {/* E6 : le reçu et le solde, depuis le dossier (font foi). */}
            {recu ? (
              <p className="text-body text-fg/70">
                Reçu :{" "}
                <strong>
                  {(recu.totalPaidXof ?? 0).toLocaleString("fr-FR")} FCFA
                </strong>{" "}
                payés sur {recu.totalAmountXof.toLocaleString("fr-FR")}.
                {(recu.remainingAmountXof ?? 0) > 0 ? (
                  <>
                    {" "}Reste :{" "}
                    <strong>
                      {(recu.remainingAmountXof ?? 0).toLocaleString("fr-FR")}{" "}
                      FCFA
                    </strong>
                    .
                  </>
                ) : (
                  " Ta place est confirmée, on te retrouve le jour J."
                )}
              </p>
            ) : recuErreur ? (
              <p className="text-body text-fg/70">
                Ton paiement est enregistré. On n&apos;affiche pas le solde
                pour l&apos;instant : {SECOURS_WHATSAPP}
              </p>
            ) : (
              <p className="text-body text-fg/70">On prépare ton reçu…</p>
            )}
          </>
        ) : issue === "echec" ? (
          <>
            <p className="text-h3 font-bold leading-tight">
              Le paiement n&apos;est pas passé.
            </p>
            <p className="text-body text-fg/70">
              Rien n&apos;a été débité et ta place est toujours retenue. Tu
              peux réessayer, ou nous écrire. {SECOURS_WHATSAPP}
            </p>
          </>
        ) : (
          <>
            <p className="text-h3 font-bold leading-tight">
              {delaiDepasse ? "Pas encore confirmé." : "On vérifie ton paiement…"}
            </p>
            <p className="text-body text-fg/70">
              {delaiDepasse
                ? "Les 3 minutes se sont écoulées sans confirmation. Si tu as validé sur ton téléphone, ça peut encore arriver : vérifie à nouveau, sans repayer."
                : "Quelques secondes. Ne ferme pas cette page et ne repaie pas."}
            </p>
          </>
        )}

        {charge || paiement ? (
          <p className="font-mono text-small text-fg/45">
            Référence :{" "}
            <span className="select-all text-fg/70">
              {paiement?.reference ?? charge?.reference}
            </span>
          </p>
        ) : null}
      </div>

      {erreur && (
        <p role="alert" className="text-small font-medium text-fg">
          {erreur}
        </p>
      )}

      {issue === "succes" ? (
        <>
          {!solde && reste !== undefined ? (
            <CtaButton href="/paiement/reprendre" pleineLargeur>
              {`Régler le reste — ${reste.toLocaleString("fr-FR")} FCFA`}
            </CtaButton>
          ) : null}
          <CtaButton href="/" pleineLargeur>
            Retour à l&apos;accueil
          </CtaButton>
        </>
      ) : issue === "echec" ? (
        <>
          <CtaButton
            type="button"
            onClick={() => {
              setResultat(null);
              setErreur(null);
              setEtape("telephone");
            }}
            pleineLargeur
          >
            Réessayer
          </CtaButton>
          <CtaButton href="/" pleineLargeur>
            Retour à l&apos;accueil
          </CtaButton>
        </>
      ) : (
        <CtaButton
          type="button"
          onClick={() => void reverifieApresDelai()}
          pleineLargeur
        >
          Vérifier à nouveau
        </CtaButton>
      )}
    </div>
  );
}

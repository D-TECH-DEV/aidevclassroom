"use client";

import { useId, useState } from "react";

import { api, ErreurApi } from "@/lib/api";
import { CtaButton } from "@/components/ui/CtaButton";
import { ParcoursPaiement } from "@/components/inscription/ParcoursPaiement";
import {
  CHARGE_DIRECTE_ACTIVE,
  adressePaiementValide,
  dossiersLocaux,
  lancePaiement,
  rangeJetonSuivi,
  rangeTrace,
  statutInscription,
  traduitPaiement,
} from "@/lib/paiement";
import type { Edition } from "@/lib/edition";

/**
 * Le formulaire de réservation. Il vit dans la modale, et nulle part
 * ailleurs — voir `ModaleInscription`.
 *
 * ── Ce que fait l'envoi ──────────────────────────────────────────────
 * `POST /enrollments` sur l'API Aidev Classroom (voir `docs/api.md`).
 * L'inscription naît `PENDING` et la réponse porte un `trackingToken` —
 * c'est la seule fois où il est renvoyé en clair. Sans lui, le participant
 * ne peut plus ni suivre son dossier ni payer : on le range tout de suite.
 *
 * Quatre champs, exactement ceux de `StudentInputDto`. Le back refuse tout
 * champ qu'il ne connaît pas (`forbidNonWhitelisted`) : on n'envoie rien
 * d'autre, et surtout rien qui touche au statut ou au montant.
 *
 * ── Le téléphone ─────────────────────────────────────────────────────
 * L'API exige du E.164 strict (`^\+[1-9]\d{6,17}$`). Personne n'écrit son
 * numéro comme ça en Côte d'Ivoire. On accepte donc la forme locale et on
 * normalise — voir `normaliseTelephone`. Refuser « 07 04 92 10 80 » ferait
 * perdre des inscriptions, et le site a un seul job.
 *
 * ── Le paiement ──────────────────────────────────────────────────────
 * Branché le 2026-10-28. L'écran de confirmation propose de régler tout de
 * suite : `lancePaiement()` rend une adresse Paystack, on y redirige, et
 * Paystack ramène sur `/paiement/retour`. Le détail est dans
 * `src/lib/paiement.ts`.
 *
 * Depuis le LOT A : la confirmation est un parcours à étapes
 * (`ParcoursPaiement`, mobile money MTN/Orange/Wave, sans carte) derrière
 * `CHARGE_DIRECTE_ACTIVE` ; l'écran Paystack ci-dessous reste en repli
 * quand `NEXT_PUBLIC_PAYSTACK_CHARGE_ENABLED` vaut `"0"`.
 *
 * L'écran de confirmation propose deux montants déterminés
 * automatiquement : le minimum du dashboard pour réserver sa place,
 * et le reste à payer. L'API tranche (`minimum ≤ montant ≤ reste`,
 * et le reste exact solde toujours, même sous le minimum).
 * et rattache autant de paiements qu'il faut à l'inscription : le reste
 * se règle plus tard, depuis la page de retour du premier versement.
 *
 * ⚠️  Il reste une dépendance côté serveur : `PAYSTACK_CALLBACK_URL` doit
 * pointer sur https://ai-devclassroom.com/paiement/retour. Tant qu'elle ne
 * l'est pas, le participant paie mais atterrit ailleurs.
 */

const WHATSAPP_AFFICHE = "07 04 92 10 80";

/** Indicatif de la Côte d'Ivoire, pour les numéros écrits en local. */
const INDICATIF_CI = "225";

/** Longueur d'un numéro ivoirien depuis le passage à 10 chiffres. */
const CHIFFRES_LOCAUX = 10;

type NomChamp =
  | "prenom"
  | "nom"
  | "email"
  | "telephone"
  | "binomePrenom"
  | "binomeNom"
  | "binomeTelephone";
type Erreurs = Partial<Record<NomChamp | "global", string>>;
type Etat = "repos" | "envoi" | "ok";
type Forfait = "SINGLE" | "DUO";

const VIDE: Record<NomChamp, string> = {
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  binomePrenom: "",
  binomeNom: "",
  binomeTelephone: "",
};

/**
 * Du numéro tel qu'on l'écrit ici vers celui qu'attend l'API.
 *
 * « 07 04 92 10 80 », « 0704921080 » et « +225 07 04 92 10 80 » donnent
 * tous `+2250704921080`. Un numéro déjà international garde son indicatif.
 * `null` quand on ne peut pas trancher : mieux vaut demander que deviner
 * un indicatif et envoyer quelqu'un dans le vide.
 */
export function normaliseTelephone(saisi: string): string | null {
  const brut = saisi.trim();
  const chiffres = brut.replace(/\D/g, "");

  const international = brut.startsWith("+") || brut.startsWith("00");
  const corps = brut.startsWith("00") ? chiffres.slice(2) : chiffres;

  if (international) {
    return /^[1-9]\d{6,17}$/.test(corps) ? `+${corps}` : null;
  }

  if (chiffres.length === CHIFFRES_LOCAUX) {
    return `+${INDICATIF_CI}${chiffres}`;
  }

  return null;
}

function verifie(
  valeurs: Record<NomChamp, string>,
  forfait: Forfait,
): Erreurs {
  const erreurs: Erreurs = {};

  if (valeurs.prenom.trim().length < 2) erreurs.prenom = "Écris ton prénom.";
  if (valeurs.nom.trim().length < 2) erreurs.nom = "Écris ton nom.";
  if (forfait === "DUO") {
    if (valeurs.binomePrenom.trim().length < 2)
      erreurs.binomePrenom = "Le prénom de ton binôme.";
    if (valeurs.binomeNom.trim().length < 2)
      erreurs.binomeNom = "Le nom de ton binôme.";
    if (normaliseTelephone(valeurs.binomeTelephone) === null)
      erreurs.binomeTelephone = valeurs.binomeTelephone.trim()
        ? "Numéro incomplet. Dix chiffres, ou l'indicatif du pays."
        : "Le numéro du binôme est obligatoire.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valeurs.email.trim())) {
    erreurs.email = "Cette adresse email n'est pas valide.";
  }

  if (normaliseTelephone(valeurs.telephone) === null) {
    erreurs.telephone = valeurs.telephone.trim()
      ? "Numéro incomplet. Dix chiffres, ou l'indicatif du pays."
      : "Le numéro est obligatoire.";
  }

  return erreurs;
}

export function Champ({
  nom,
  etiquette,
  aide,
  erreur,
  valeur,
  onChange,
  ...input
}: {
  nom: NomChamp;
  etiquette: string;
  aide?: string;
  erreur?: string;
  valeur: string;
  onChange: (valeur: string) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name" | "value" | "onChange"
>) {
  const id = useId();
  const idAide = `${id}-aide`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label
        htmlFor={id}
        className="font-mono text-small uppercase tracking-[0.15em] text-fg/60"
      >
        {etiquette}
      </label>

      <input
        {...input}
        id={id}
        name={nom}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur || aide ? idAide : undefined}
        // `border-color` et rien d'autre change au focus : pas d'ombre,
        // pas de lueur. Le `:focus-visible` global pose déjà le contour.
        //
        // Un champ fautif se marque en blanc franc, pas en vert : le vert
        // est la couleur de l'accent et du succès sur tout le site, il
        // dirait l'inverse de ce qui se passe. Le système de design n'a
        // pas de couleur d'alerte — à décider avec Malik, en attendant
        // c'est le contraste qui porte le message.
        className={`w-full rounded-field border bg-bg
                    px-[clamp(0.875rem,2vw,1.125rem)]
                    py-[clamp(0.6875rem,1.6svh,0.9375rem)]
                    text-body text-fg transition-colors duration-[160ms]
                    placeholder:text-fg/30
                    ${erreur ? "border-fg/55" : "border-fg/15"}`}
      />

      {(erreur || aide) && (
        <p
          id={idAide}
          // Le message d'erreur se substitue à l'aide : deux lignes sous
          // un champ, l'œil ne sait plus laquelle compte.
          className={`text-small ${
            erreur ? "font-medium text-fg" : "text-fg/45"
          }`}
        >
          {erreur ?? aide}
        </p>
      )}
    </div>
  );
}

/**
 * Ce que l'API renvoie à la création d'une inscription. L'inscription
 * embarque son sprint (voir `include` côté API) : c'est de lui que vient
 * le minimum de versement qui fait foi, pas du catalogue.
 */
type ReponseInscription = {
  enrollment: {
    id: number;
    status: string;
    plan?: Forfait;
    /** Le prix figé au moment de la réservation : seule valeur à payer. */
    totalAmountXof: number;
    sprint?: {
      minimumPaymentXof?: number;
      duoMinimumPaymentXof?: number | null;
    } | null;
  };
  trackingToken: string;
};

/**
 * Ce qu'on garde d'une inscription réussie, le temps de proposer le
 * paiement. Le jeton ne transite que par la mémoire de l'onglet et par
 * `localStorage` — jamais par l'adresse.
 *
 * `totalXof` et `minimumXof` viennent de la réponse serveur, jamais du
 * catalogue : si le prix a changé entre l'affichage du catalogue et la
 * réservation, c'est le total figé qui fait foi.
 */
export type Confirmee = {
  id: number;
  jeton: string;
  prenom: string;
  email: string;
  forfait: Forfait;
  binome?: string;
  totalXof: number;
  minimumXof: number;
  /** Le numéro saisi, tel quel : pré-remplit l'étape téléphone du parcours. */
  telephone?: string;
};

/**
 * Déjà inscrit avec cet e-mail : l'écran affiche le reste à payer et
 * le bouton payer juste sous ce message, sans changer de page.
 */
export const DEJA_INSCRIT = "Tu es déjà inscrit avec cette adresse.";

/** Le message à montrer pour une erreur venue du serveur. */
function traduit(erreur: ErreurApi): Erreurs {
  switch (erreur.code) {
    // Déjà inscrit avec ce couple étudiant + sprint. C'est l'email qui
    // identifie l'étudiant côté API : l'erreur se pose donc là.
    case "DUPLICATE_ENROLLMENT":
      return { email: DEJA_INSCRIT };

    case "SPRINT_CAPACITY_REACHED":
      return {
        global: `C'est complet. Écris-nous sur WhatsApp au ${WHATSAPP_AFFICHE}, on te met sur la liste d'attente.`,
      };

    case "DUO_NOT_AVAILABLE":
      return {
        global: `Le forfait duo n'est plus disponible. Choisis le forfait solo.`,
      };

    case "PARTNER_REQUIRED":
      return {
        binomePrenom: "Le prénom de ton binôme.",
        binomeNom: "Le nom de ton binôme.",
        binomeTelephone: "Le numéro du binôme est obligatoire.",
      };

    case "TOO_MANY_REQUESTS":
      return { global: "Trop de tentatives d'un coup. Réessaie dans une minute." };

    // `SPRINT_NOT_FOUND`, `SPRINT_NOT_ACTIVE`, validation : le serveur
    // écrit déjà en français et c'est lui qui fait autorité.
    default:
      return {
        global:
          erreur.statusCode >= 500
            ? `L'envoi a échoué. Réessaie, ou écris-nous sur WhatsApp au ${WHATSAPP_AFFICHE}.`
            : erreur.message,
      };
  }
}

export function FormulaireInscription({ edition }: { edition: Edition }) {
  const [valeurs, setValeurs] = useState(VIDE);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [etat, setEtat] = useState<Etat>("repos");
  // Le forfait choisi : solo, ou duo quand le sprint le propose.
  const duoPropose = edition.prixDuoFCFA != null;
  const [forfait, setForfait] = useState<Forfait>("SINGLE");
  const [confirmee, setConfirmee] = useState<Confirmee | null>(null);
  // « Précédent » depuis l'étape moyen du parcours : on remontre le
  // formulaire (données conservées, voir `envoie`) sans perdre le dossier.
  const [revientFormulaire, setRevientFormulaire] = useState(false);
  // Reprise « déjà inscrit » : le reste se paie dans le même parcours.
  const [dossierReprise, setDossierReprise] = useState<{
    id: number;
    jeton: string;
    prenom: string;
    email?: string;
    reste: number;
    total: number;
  } | null>(null);
  const [paiementEnCours, setPaiementEnCours] = useState(false);
  const [erreurPaiement, setErreurPaiement] = useState<string | null>(null);
  // Reprise instantanée après un « déjà inscrit » : le dossier retrouvé
  // sur cet appareil, avec son reste à payer. `ratee` = pas trouvé ici.
  const [reprise, setReprise] = useState<
    { id: number; jeton: string; prenom: string; email?: string; reste: number; total: number } | null
  >(null);
  const [rechercheReprise, setRechercheReprise] = useState(false);
  const [repriseRatee, setRepriseRatee] = useState(false);

  const ecrit = (champ: NomChamp) => (valeur: string) => {
    setValeurs((v) => ({ ...v, [champ]: valeur }));
    // L'erreur d'un champ disparaît dès qu'on le corrige, pas au prochain
    // envoi : garder un champ marqué pendant qu'on le retape est faux.
    setErreurs((precedentes) => {
      const suivantes = { ...precedentes };
      delete suivantes[champ];
      return suivantes;
    });
    // Changer d'e-mail invalide la reprise affichée : elle portait sur
    // l'adresse précédente.
    if (champ === "email") {
      setReprise(null);
      setRepriseRatee(false);
    }
  };

  /**
   * Retrouve le dossier de cette session parmi ceux connus de ce
   * navigateur, et lit son reste à payer. Instantané quand le dossier
   * est ici ; sinon on le dit, sans inventer un montant.
   */
  async function retrouveDossier(sprintId: number, prenomSaisi: string) {
    setRechercheReprise(true);
    setReprise(null);
    setRepriseRatee(false);

    try {
      for (const local of dossiersLocaux()) {
        try {
          const suivi = await statutInscription(
            local.idInscription,
            local.jeton,
          );
          if (suivi.sprint?.id !== sprintId) continue;
          setReprise({
            id: local.idInscription,
            jeton: local.jeton,
            prenom: local.prenom || prenomSaisi,
            email: local.email,
            reste: suivi.remainingAmountXof ?? 0,
            total: suivi.totalAmountXof,
          });
          return;
        } catch {
          // Jeton périmé ou dossier illisible : on essaie le suivant.
          continue;
        }
      }
      setRepriseRatee(true);
    } finally {
      setRechercheReprise(false);
    }
  }

  async function envoie(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (etat === "envoi") return;

    const trouvees = verifie(valeurs, forfait);
    if (Object.keys(trouvees).length > 0) {
      setErreurs(trouvees);
      return;
    }

    setErreurs({});
    setEtat("envoi");

    try {
      const { enrollment, trackingToken } = await api<ReponseInscription>(
        "/enrollments",
        {
          method: "POST",
          body: JSON.stringify({
            sprintId: edition.id,
            plan: forfait,
            ...(forfait === "DUO"
              ? {
                  partnerFirstName: valeurs.binomePrenom.trim(),
                  partnerLastName: valeurs.binomeNom.trim(),
                  partnerPhone: normaliseTelephone(valeurs.binomeTelephone),
                }
              : {}),
            student: {
              firstName: valeurs.prenom.trim(),
              lastName: valeurs.nom.trim(),
              email: valeurs.email.trim(),
              phone: normaliseTelephone(valeurs.telephone),
            },
          }),
        },
      );

      rangeJetonSuivi(enrollment.id, trackingToken);
      const planServeur = enrollment.plan ?? forfait;
      setConfirmee({
        id: enrollment.id,
        jeton: trackingToken,
        prenom: valeurs.prenom.trim(),
        email: valeurs.email.trim().toLowerCase(),
        forfait: planServeur,
        binome:
          planServeur === "DUO"
            ? `${valeurs.binomePrenom.trim()} ${valeurs.binomeNom.trim()}`.trim()
            : undefined,
        // Le total figé par le serveur fait foi, pas le prix du
        // catalogue (qui a pu changer entre-temps). Repli sur le
        // catalogue si la réponse ne porte pas le sprint.
        totalXof: enrollment.totalAmountXof,
        minimumXof:
          planServeur === "DUO"
            ? (enrollment.sprint?.duoMinimumPaymentXof ??
              edition.minimumDuoFCFA ??
              enrollment.sprint?.minimumPaymentXof ??
              edition.minimumFCFA)
            : (enrollment.sprint?.minimumPaymentXof ?? edition.minimumFCFA),
        telephone: valeurs.telephone,
      });
      // Les valeurs sont conservées : « Précédent » depuis le parcours de
      // paiement remontre ce formulaire pré-rempli au lieu d'une page vide.
      setRevientFormulaire(false);
      setDossierReprise(null);
      setEtat("ok");
    } catch (cause) {
      setEtat("repos");
      setErreurs(
        cause instanceof ErreurApi
          ? traduit(cause)
          : {
              global:
                "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.",
            },
      );
      // Déjà inscrit avec cet e-mail : on cherche le dossier tout de
      // suite, pour afficher son reste sans changer de page.
      if (cause instanceof ErreurApi && cause.code === "DUPLICATE_ENROLLMENT") {
        void retrouveDossier(edition.id, valeurs.prenom.trim());
      }
    }
  }

  /**
   * Lance le versement et part chez Paystack.
   *
   * On range la trace AVANT de rediriger : une fois l'onglet parti, il
   * n'y a plus de code à nous pour l'écrire, et sans elle la page de
   * retour ne saura pas à quel dossier rattacher la référence.
   */
  async function lanceEtRedirige(
    idInscription: number,
    jeton: string,
    prenom: string,
    montant: number,
    email?: string,
  ) {
    if (paiementEnCours) return;

    setPaiementEnCours(true);
    setErreurPaiement(null);

    try {
      const lance = await lancePaiement(idInscription, montant, jeton);

      if (!adressePaiementValide(lance.authorizationUrl)) {
        throw new Error(`adresse de paiement inattendue : ${lance.authorizationUrl}`);
      }

      rangeTrace(lance.reference, {
        idInscription,
        jeton,
        prenom,
        montantXof: montant,
        email,
      });

      window.location.href = lance.authorizationUrl;
    } catch (cause) {
      setPaiementEnCours(false);
      setErreurPaiement(traduitPaiement(cause));
    }
  }

  async function paie(montant: number) {
    if (!confirmee) return;
    await lanceEtRedirige(
      confirmee.id,
      confirmee.jeton,
      confirmee.prenom,
      montant,
      confirmee.email,
    );
  }

  // Reprise « déjà inscrit » : le même parcours, avec un seul montant
  // possible (le reste). L'ancien parcours (redirection Paystack) reste
  // branché sur le bouton d'origine quand le repli est actif.
  if (dossierReprise && CHARGE_DIRECTE_ACTIVE) {
    return (
      <ParcoursPaiement
        key={`reprise-${dossierReprise.id}`}
        dossier={{
          idInscription: dossierReprise.id,
          jeton: dossierReprise.jeton,
          prenom: dossierReprise.prenom,
          email: dossierReprise.email,
          totalXof: dossierReprise.total,
          minimumXof: dossierReprise.reste,
          resteXof: dossierReprise.reste,
          telephonePrefill: valeurs.telephone,
        }}
        onPrecedent={() => setDossierReprise(null)}
      />
    );
  }

  if (etat === "ok" && confirmee && !revientFormulaire) {
    // Le parcours à étapes (voir `ParcoursPaiement`) : même modale, mêmes
    // classes, navigation Précédent/Suivant. L'ancien écran de redirection
    // Paystack suit, derrière le repli `CHARGE_DIRECTE_ACTIVE`.
    if (CHARGE_DIRECTE_ACTIVE) {
      return (
        <ParcoursPaiement
          key={`confirmee-${confirmee.id}`}
          dossier={{
            idInscription: confirmee.id,
            jeton: confirmee.jeton,
            prenom: confirmee.prenom,
            email: confirmee.email,
            totalXof: confirmee.totalXof,
            minimumXof: confirmee.minimumXof,
            forfait: confirmee.forfait,
            binome: confirmee.binome,
            telephonePrefill: confirmee.telephone,
          }}
          onPrecedent={() => setRevientFormulaire(true)}
        />
      );
    }

    // Un seul montant, déterminé automatiquement : le reste à payer
    // (ici le total figé côté serveur, rien n'étant encore versé).
    // Fini les 30 % : le minimum du dashboard reste le plancher servi
    // par l'API, et le reste exact solde toujours, même sous le minimum.
    // Le montant vient de l'inscription figée côté serveur (`confirmee`),
    // jamais du catalogue : un prix modifié entre l'affichage et la
    // réservation ne doit pas fausser le versement.
    const resteAPayer = confirmee.totalXof;

    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-card border border-accent/60
                   px-[clamp(1.25rem,3vw,2rem)]
                   py-[clamp(1.5rem,4svh,2.5rem)] text-center"
      >
        <p className="text-h3 font-bold leading-tight">
          C&apos;est noté, {confirmee.prenom}.
        </p>
        <p className="text-body text-fg/70">
          {confirmee.forfait === "DUO" ? (
            <>
              Deux places retenues
              {confirmee.binome ? ` — avec ${confirmee.binome}` : ""}. Elles
              sont confirmées une fois les{" "}
              {confirmee.totalXof.toLocaleString("fr-FR")} FCFA réglés.
            </>
          ) : (
            <>
              Ta place est retenue. Elle est confirmée une fois les{" "}
              {confirmee.totalXof.toLocaleString("fr-FR")} FCFA réglés.
            </>
          )}
        </p>

        {/* Deux montants déterminés automatiquement : le minimum du
            dashboard pour réserver sa place, ou le reste à payer.
            Le reste se règle plus tard avec l'e-mail de l'inscription,
            depuis n'importe quel appareil. */}
        {confirmee.minimumXof < resteAPayer ? (
          <CtaButton
            type="button"
            onClick={() => void paie(confirmee.minimumXof)}
            disabled={paiementEnCours}
            pleineLargeur
            className="mt-[clamp(0.25rem,1svh,0.75rem)]"
          >
            {paiementEnCours
              ? "Ouverture du paiement…"
              : `Réserver ma place — ${confirmee.minimumXof.toLocaleString("fr-FR")} FCFA`}
          </CtaButton>
        ) : null}

        <CtaButton
          type="button"
          onClick={() => void paie(resteAPayer)}
          disabled={paiementEnCours}
          pleineLargeur
          className="mt-[clamp(0.25rem,1svh,0.75rem)]"
        >
          {paiementEnCours
            ? "Ouverture du paiement…"
            : `Payer — ${resteAPayer.toLocaleString("fr-FR")} FCFA`}
        </CtaButton>

        {erreurPaiement && (
          <p role="alert" className="text-small font-medium text-fg">
            {erreurPaiement}
          </p>
        )}

        <p className="text-small text-fg/45">
          Paiement par Paystack. Le reste se règle plus tard, depuis la{" "}
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

  return (
    <form
      onSubmit={envoie}
      noValidate
      className="flex flex-col gap-[clamp(1rem,2.5svh,1.5rem)]"
    >
      {/* Le forfait : solo, ou duo (2 places) quand le sprint le propose.
          Le prix duo est figé côté serveur à la réservation. */}
      {duoPropose ? (
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Forfait">
          <button
            type="button"
            role="radio"
            aria-checked={forfait === "SINGLE"}
            onClick={() => setForfait("SINGLE")}
            className={`rounded-card border px-4 py-3 text-left transition-colors duration-[160ms] ${
              forfait === "SINGLE" ? "border-accent/60 bg-surface" : "border-fg/15"
            }`}
          >
            <span className="block text-body font-bold">Solo — 1 place</span>
            <span className="mt-1 block font-mono text-small text-fg/60">
              {edition.prixFCFA.toLocaleString("fr-FR")} FCFA
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={forfait === "DUO"}
            onClick={() => setForfait("DUO")}
            className={`rounded-card border px-4 py-3 text-left transition-colors duration-[160ms] ${
              forfait === "DUO" ? "border-accent/60 bg-surface" : "border-fg/15"
            }`}
          >
            <span className="block text-body font-bold">Duo — 2 places</span>
            <span className="mt-1 block font-mono text-small text-fg/60">
              {(edition.prixDuoFCFA ?? 0).toLocaleString("fr-FR")} FCFA
            </span>
          </button>
        </div>
      ) : null}

      {/* Prénom et nom sur une rangée : l'API les veut séparés, mais deux
          champs courts l'un sous l'autre allongent le panneau pour rien. */}
      <div className="grid gap-[clamp(1rem,2.5svh,1.5rem)] sm:grid-cols-2">
        <Champ
          nom="prenom"
          etiquette="Prénom"
          valeur={valeurs.prenom}
          onChange={ecrit("prenom")}
          erreur={erreurs.prenom}
          type="text"
          autoComplete="given-name"
          enterKeyHint="next"
          maxLength={100}
          placeholder="Konan"
        />

        <Champ
          nom="nom"
          etiquette="Nom"
          valeur={valeurs.nom}
          onChange={ecrit("nom")}
          erreur={erreurs.nom}
          type="text"
          autoComplete="family-name"
          enterKeyHint="next"
          maxLength={100}
          placeholder="Yao"
        />
      </div>

      {/* Le binôme : seulement en duo, une place chacun sous un seul dossier. */}
      {forfait === "DUO" ? (
        <>
        <div className="grid gap-[clamp(1rem,2.5svh,1.5rem)] sm:grid-cols-2">
          <Champ
            nom="binomePrenom"
            etiquette="Prénom du binôme"
            valeur={valeurs.binomePrenom}
            onChange={ecrit("binomePrenom")}
            erreur={erreurs.binomePrenom}
            type="text"
            autoComplete="off"
            maxLength={100}
            placeholder="Awa"
          />

          <Champ
            nom="binomeNom"
            etiquette="Nom du binôme"
            valeur={valeurs.binomeNom}
            onChange={ecrit("binomeNom")}
            erreur={erreurs.binomeNom}
            type="text"
            autoComplete="off"
            maxLength={100}
            placeholder="Diallo"
          />
        </div>

        <Champ
          nom="binomeTelephone"
          etiquette="Téléphone du binôme"
          aide="Dix chiffres suffisent, on ajoute le +225."
          valeur={valeurs.binomeTelephone}
          onChange={ecrit("binomeTelephone")}
          erreur={erreurs.binomeTelephone}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="07 04 92 10 80"
        />
        </>
      ) : null}

      <Champ
        nom="telephone"
        etiquette="Téléphone (WhatsApp)"
        aide="Dix chiffres suffisent, on ajoute le +225."
        valeur={valeurs.telephone}
        onChange={ecrit("telephone")}
        erreur={erreurs.telephone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        enterKeyHint="next"
        placeholder="07 04 92 10 80"
      />

      <Champ
        nom="email"
        etiquette="Email"
        valeur={valeurs.email}
        onChange={ecrit("email")}
        erreur={erreurs.email}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="send"
        maxLength={190}
        placeholder="konan@exemple.ci"
      />

      {/* Déjà inscrit : le reste et le bouton payer s'affichent ici
          même, sans changer de page. Le dossier est cherché dès
          l'erreur, parmi ceux connus de ce navigateur. */}
      {erreurs.email === DEJA_INSCRIT ? (
        <div
          role="status"
          className="-mt-2 rounded-card border border-fg/15 bg-surface
                     px-[clamp(0.875rem,2vw,1.125rem)]
                     py-[clamp(0.6875rem,1.6svh,0.9375rem)]"
        >
          {rechercheReprise ? (
            <p className="text-small text-fg/60">
              On cherche ton dossier…
            </p>
          ) : reprise && reprise.reste > 0 ? (
            <>
              <p className="text-body">
                Reste à payer :{" "}
                <strong>
                  {reprise.reste.toLocaleString("fr-FR")} FCFA
                </strong>{" "}
                <span className="text-fg/55">
                  (sur {reprise.total.toLocaleString("fr-FR")})
                </span>
              </p>
              {CHARGE_DIRECTE_ACTIVE ? (
                <CtaButton
                  type="button"
                  onClick={() =>
                    setDossierReprise({
                      id: reprise.id,
                      jeton: reprise.jeton,
                      prenom: reprise.prenom,
                      email: reprise.email,
                      reste: reprise.reste,
                      total: reprise.total,
                    })
                  }
                  pleineLargeur
                  className="mt-3"
                >
                  {`Payer le reste — ${reprise.reste.toLocaleString("fr-FR")} FCFA`}
                </CtaButton>
              ) : (
                <CtaButton
                  type="button"
                  onClick={() =>
                    void lanceEtRedirige(
                      reprise.id,
                      reprise.jeton,
                      reprise.prenom,
                      reprise.reste,
                      reprise.email,
                    )
                  }
                  disabled={paiementEnCours}
                  pleineLargeur
                  className="mt-3"
                >
                  {paiementEnCours
                    ? "Ouverture du paiement…"
                    : `Payer le reste — ${reprise.reste.toLocaleString("fr-FR")} FCFA`}
                </CtaButton>
              )}
              {erreurPaiement ? (
                <p role="alert" className="mt-2 text-small font-medium text-fg">
                  {erreurPaiement}
                </p>
              ) : null}
            </>
          ) : reprise ? (
            <p className="text-body text-fg/80">
              C&apos;est déjà réglé, ta place est confirmée.
            </p>
          ) : repriseRatee ? (
            <p className="text-small text-fg/70">
              Dossier introuvable sur cet appareil. Retrouve-le avec ton
              e-mail sur la{" "}
              <a
                href="/paiement/reprendre"
                className="underline decoration-fg/25 underline-offset-4"
              >
                page « reprendre mon paiement »
              </a>
              , ou écris-nous sur WhatsApp au {WHATSAPP_AFFICHE}.
            </p>
          ) : null}
        </div>
      ) : null}

      {erreurs.global && (
        <p role="alert" className="text-small font-medium text-fg">
          {erreurs.global}
        </p>
      )}

      <CtaButton
        type="submit"
        disabled={etat === "envoi"}
        pleineLargeur
        className="mt-[clamp(0.25rem,1svh,0.75rem)]"
      >
        {etat === "envoi" ? "Envoi…" : "Réserver ma place"}
      </CtaButton>

      {/* Pas de case à cocher de consentement tant que la politique de
          confidentialité n'existe pas : une case qui renvoie vers une page
          absente ne protège personne. */}
      <p className="text-small text-fg/45">
        On n&apos;utilise ces informations que pour ton inscription.
      </p>
    </form>
  );
}

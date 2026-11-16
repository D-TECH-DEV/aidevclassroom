import { api, ErreurApi } from "@/lib/api";

/**
 * Le paiement Paystack, côté site.
 *
 * ── Le parcours, en quatre temps ──────────────────────────────────────
 * 1. `POST /enrollments` crée l'inscription et renvoie un `trackingToken`
 *    (voir `FormulaireInscription`).
 * 2. `POST /payments/enrollments/:id/initialize` rend une `authorizationUrl`
 *    Paystack. On y redirige.
 * 3. Paystack rappelle `/paiement/retour?reference=…` sur notre site.
 * 4. `GET /payments/:reference/verify` donne le statut qui fait foi.
 *
 * ── Pourquoi une vérification serveur ────────────────────────────────
 * Le retour navigateur ne prouve rien : l'adresse se bricole à la main.
 * Seuls `verify` et le webhook signé font autorité, et c'est aussi ce que
 * dit la doc de l'API mot pour mot. Le site n'écrit donc jamais « payé »
 * sur la foi d'une redirection.
 *
 * ── Le jeton de suivi, et sa récupération ──────────────────────────
 * L'API renvoie le `trackingToken` à l'inscription, et le re-emet par
 * e-mail via `POST /enrollments/by-email` (rotation : l'ancien jeton est
 * remplacé). Il n'y a ni compte ni mot de passe : ce jeton EST la preuve
 * que le dossier est le nôtre. On le range dans `localStorage`, ce qui
 * veut dire qu'il ne survit ni à un autre appareil, ni à une navigation
 * privée, ni à un stockage vidé. Dans ce cas l'e-mail retrouve le dossier
 * (`retrouveDossiersParEmail`) et ce navigateur redevient capable de payer.
 * Sans OTP : quiconque connaît l'e-mail obtient l'accès — assumé.
 *
 * On range donc le jeton sous deux clés. Par identifiant d'inscription,
 * pour reprendre un dossier. Par référence de paiement, parce que Paystack
 * ne nous renvoie que celle-là et qu'il faut remonter au jeton depuis
 * elle.
 */

/** Le préfixe de toutes nos clés de stockage, pour ne pas s'éparpiller. */
const PREFIXE = "aidevsprint";

export type StatutPaiement = "PENDING" | "SUCCESS" | "FAILED" | "ABANDONED";

/** Ce que rend `initialize`. */
export type PaiementLance = {
  paymentId: number;
  reference: string;
  status: StatutPaiement;
  authorizationUrl: string;
};

/**
 * Ce que rend `verify`. Seul `status` est garanti par la doc ; les soldes
 * y sont annoncés en prose, sans schéma. Ils sont donc optionnels, et
 * l'affichage ne s'appuie jamais dessus pour dire l'essentiel.
 */
export type PaiementVerifie = {
  status: StatutPaiement;
  reference: string;
  amountXof?: number;
  paidAt?: string | null;
  totalPaidXof?: number;
  remainingAmountXof?: number;
};

/** Ce qu'on garde en local pour pouvoir vérifier au retour de Paystack. */
export type TracePaiement = {
  idInscription: number;
  jeton: string;
  prenom: string;
  montantXof: number;
  /** Ajouté après coup pour retrouver un dossier par e-mail. Les traces
      d'avant ne l'ont pas : elles restent utilisables, sans filtre. */
  email?: string;
};

/** Un dossier retrouvé sur cet appareil, avant d'interroger l'API. */
export type DossierLocal = {
  idInscription: number;
  jeton: string;
  prenom?: string;
  email?: string;
};

/** Le résumé que rend `GET /enrollments/:id/status` (soldes inclus). */
export type DossierSuivi = {
  id: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  plan?: "SINGLE" | "DUO";
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
  partnerPhone?: string | null;
  totalAmountXof: number;
  totalPaidXof?: number;
  remainingAmountXof?: number;
  sprint?: {
    id: number;
    name: string;
    status: string;
    minimumPaymentXof: number;
  } | null;
};

/* ── Stockage local ──────────────────────────────────────────────────── */

/**
 * Toutes les écritures passent par là, et toutes échouent en silence :
 * navigation privée, stockage bloqué, quota plein. Aucune de ces
 * situations ne doit casser une inscription déjà enregistrée côté serveur.
 */
function ecrit(cle: string, valeur: string) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    // Rien à faire ici, et rien à dire au visiteur.
  }
}

function lit(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

export function rangeJetonSuivi(idInscription: number, jeton: string) {
  ecrit(`${PREFIXE}.suivi.${idInscription}`, jeton);
}

export function litJetonSuivi(idInscription: number): string | null {
  return lit(`${PREFIXE}.suivi.${idInscription}`);
}

export function rangeTrace(reference: string, trace: TracePaiement) {
  ecrit(`${PREFIXE}.paiement.${reference}`, JSON.stringify(trace));
}

/**
 * La trace d'un paiement lancé depuis ce navigateur. `null` quand on
 * revient d'ailleurs — et c'est un cas normal, pas une anomalie.
 */
export function litTrace(reference: string): TracePaiement | null {
  const brut = lit(`${PREFIXE}.paiement.${reference}`);
  if (!brut) return null;

  try {
    const trace: unknown = JSON.parse(brut);
    // Une clé écrite par une version plus ancienne du site ne doit pas
    // faire planter la page de retour.
    return typeof trace === "object" &&
      trace !== null &&
      typeof (trace as TracePaiement).jeton === "string"
      ? (trace as TracePaiement)
      : null;
  } catch {
    return null;
  }
}

/**
 * Les dossiers d'inscription connus de ce navigateur : jetons rangés à
 * l'inscription (`suivi.<id>`) et traces des versements lancés
 * (`paiement.<reference>`), dédupliqués par inscription.
 *
 * Même navigateur, même appareil : le jeton de suivi ne sort jamais
 * d'ici, donc un dossier ouvert ailleurs reste introuvable — c'est
 * assumé, voir l'en-tête du module.
 */
export function dossiersLocaux(): DossierLocal[] {
  const parId = new Map<number, DossierLocal>();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i);
      if (!cle || !cle.startsWith(`${PREFIXE}.`)) continue;

      const suivi = cle.match(/\.suivi\.(\d+)$/);
      if (suivi) {
        const id = Number(suivi[1]);
        const jeton = lit(cle);
        if (jeton && !parId.has(id)) {
          parId.set(id, { idInscription: id, jeton });
        }
        continue;
      }

      if (cle.includes(".paiement.")) {
        const trace = litTrace(cle.slice(`${PREFIXE}.paiement.`.length));
        if (trace && !parId.has(trace.idInscription)) {
          parId.set(trace.idInscription, {
            idInscription: trace.idInscription,
            jeton: trace.jeton,
            prenom: trace.prenom,
            email: trace.email,
          });
        }
      }
    }
  } catch {
    return [];
  }

  return [...parId.values()];
}

/** Le résumé d'un dossier : montants, solde, statut. */
export async function statutInscription(
  idInscription: number,
  jeton: string,
): Promise<DossierSuivi> {
  return api<DossierSuivi>(`/enrollments/${idInscription}/status`, {
    jetonSuivi: jeton,
    cache: "no-store",
  });
}

/** Un dossier rendu par la recherche par e-mail, avec son jeton tout neuf. */
export type DossierRecupere = DossierSuivi & {
  trackingToken: string;
  plan?: "SINGLE" | "DUO";
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
};

/**
 * Retrouve les dossiers d'un e-mail, depuis n'importe quel appareil.
 *
 * L'API re-emet un jeton de suivi par dossier (rotation) et le renvoie :
 * on le range aussitot dans ce navigateur, qui devient capable de payer
 * le reste. Sans OTP : quiconque connait l'e-mail obtient l'acces.
 */
export async function retrouveDossiersParEmail(
  email: string,
): Promise<DossierRecupere[]> {
  const reponse = await api<{ dossiers: DossierRecupere[] }>(
    `/enrollments/by-email`,
    {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
      cache: "no-store",
    },
  );
  for (const dossier of reponse.dossiers) {
    rangeJetonSuivi(dossier.id, dossier.trackingToken);
  }
  return reponse.dossiers;
}

/* ── Appels ──────────────────────────────────────────────────────────── */

/**
 * Lance un versement et rend l'adresse Paystack où envoyer le visiteur.
 *
 * `montantXof` est un entier : l'API transmet le XOF tel quel, sans
 * centimes. Elle vérifie elle-même `minimumPaymentXof ≤ montant ≤ reste`.
 */
export async function lancePaiement(
  idInscription: number,
  montantXof: number,
  jeton: string,
): Promise<PaiementLance> {
  return api<PaiementLance>(`/payments/enrollments/${idInscription}/initialize`, {
    method: "POST",
    jetonSuivi: jeton,
    body: JSON.stringify({ amountXof: montantXof }),
  });
}

/**
 * Le statut qui fait foi.
 *
 * Le jeton part en en-tête, jamais en paramètre d'adresse : l'API accepte
 * `?trackingToken=`, mais une adresse se retrouve dans l'historique, dans
 * les journaux du serveur et dans le `Referer` de la page suivante. Un
 * jeton qui tient lieu de mot de passe n'a rien à y faire.
 */
/**
 * L'adresse de paiement vient de notre API, mais on la contrôle quand
 * même avant d'y envoyer quelqu'un : une redirection est la dernière
 * chose qu'on veut voir détournée, et la vérification coûte trois lignes.
 */
export function adressePaiementValide(adresse: string): boolean {
  try {
    const url = new URL(adresse);
    return (
      url.protocol === "https:" &&
      (url.hostname === "paystack.com" || url.hostname.endsWith(".paystack.com"))
    );
  } catch {
    return false;
  }
}

export async function verifiePaiement(
  reference: string,
  jeton: string,
): Promise<PaiementVerifie> {
  return api<PaiementVerifie>(`/payments/${encodeURIComponent(reference)}/verify`, {
    jetonSuivi: jeton,
    cache: "no-store",
  });
}

/* ── Messages ────────────────────────────────────────────────────────── */

const WHATSAPP_AFFICHE = "07 04 92 10 80";

/** Le repli, quand il n'y a plus qu'un humain pour débloquer la situation. */
export const SECOURS_WHATSAPP = `Écris-nous sur WhatsApp au ${WHATSAPP_AFFICHE}.`;

/**
 * Ce qu'on montre pour une erreur de paiement.
 *
 * Le visiteur vient de sortir sa carte ou son mobile money : il lui faut
 * savoir si son argent est parti, et quoi faire maintenant. Les codes du
 * back sont écrits pour un développeur, pas pour lui.
 */
export function traduitPaiement(erreur: unknown): string {
  if (!(erreur instanceof ErreurApi)) {
    return `Impossible de joindre le serveur. Vérifie ta connexion et réessaie. ${SECOURS_WHATSAPP}`;
  }

  switch (erreur.code) {
    case "ENROLLMENT_ALREADY_SETTLED":
      return "Cette inscription est déjà réglée. Il n'y a plus rien à payer.";

    case "PAYMENT_AMOUNT_EXCEEDS_BALANCE":
      return `Le montant dépasse ce qu'il reste à régler. ${SECOURS_WHATSAPP}`;

    case "PAYMENT_AMOUNT_BELOW_MINIMUM":
    case "BELOW_MINIMUM":
    case "PAYMENT_AMOUNT_INVALID":
      return `Ce montant n'est pas accepté. ${SECOURS_WHATSAPP}`;

    case "ENROLLMENT_CANCELLED":
      return `Cette inscription a été annulée. ${SECOURS_WHATSAPP}`;

    case "ENROLLMENT_NOT_FOUND":
      return `Cette inscription est introuvable. ${SECOURS_WHATSAPP}`;

    case "TRACKING_TOKEN_REQUIRED":
    case "TRACKING_TOKEN_INVALID":
      return `Ce navigateur n'a plus la clé de ton dossier. ${SECOURS_WHATSAPP}`;

    // Deux noms pour le même conflit selon la page de la doc consultée.
    case "REFERENCE_CONFLICT":
    case "PAYMENT_REFERENCE_CONFLICT":
      return "Un paiement est déjà en cours pour cette inscription. Attends une minute et réessaie.";

    case "PAYSTACK_UNAVAILABLE":
      return "Le service de paiement ne répond pas. Ton inscription est gardée : réessaie dans quelques minutes.";

    case "PAYSTACK_VERIFY_FAILED":
      return "On n'arrive pas à joindre le service de paiement pour confirmer. Si tu as payé, c'est enregistré de leur côté : réessaie dans un instant.";

    case "INVALID_PROVIDER":
    case "PAYMENT_PROVIDER_INVALID":
      return "Cet opérateur n'est pas pris en charge. Choisis MTN, Orange ou Wave.";

    case "PAYMENT_PHONE_INVALID":
      return "Ce numéro n'est pas accepté. Dix chiffres ivoiriens, on ajoute le +225.";

    case "PAYMENT_CHARGE_FAILED":
      return "Le paiement mobile a échoué. Aucun montant n'a été débité : tu peux réessayer.";

    case "PAYSTACK_VERIFY_TIMEOUT":
      return "La vérification prend plus de temps que prévu. Ton inscription est gardée : vérifie à nouveau dans un instant.";

    case "PAYMENT_VERIFICATION_MISMATCH":
      return `Le paiement ne correspond pas à ce qui était attendu. Ne repaie surtout pas. ${SECOURS_WHATSAPP}`;

    default:
      return erreur.statusCode >= 500
        ? `Le serveur a eu un problème. ${SECOURS_WHATSAPP}`
        : erreur.message;
  }
}

/* ── Paiement mobile money direct (charge, sans carte) ─────────────── */

/**
 * Le parcours par défaut : charge mobile money directe (MTN, Orange,
 * Wave), sans carte bancaire et sans redirection.
 *
 * L'ancien parcours (Paystack `initialize` + redirection vers
 * `authorizationUrl`, cartes incluses) reste en place et reprend la main
 * quand `NEXT_PUBLIC_PAYSTACK_CHARGE_ENABLED` vaut `"0"`. Les cartes sont
 * une décision produit abandonnée : l'ancien parcours ne sert qu'en
 * repli, jamais comme choix proposé.
 *
 * Montant : toujours issu du serveur (total figé, minimum du sprint),
 * jamais saisi. Secrets : on ne collecte ni PIN ni OTP ni code — seul le
 * numéro de téléphone transite, et rien de sensible n'est journalisé.
 */

/** Les seuls opérateurs proposés. Pas de carte, par décision produit. */
export type OperateurMobile = "mtn" | "orange" | "wave";

export const OPERATEURS_MOBILES: ReadonlyArray<{
  code: OperateurMobile;
  nom: string;
  detail: string;
}> = [
  { code: "mtn", nom: "MTN", detail: "MTN Mobile Money" },
  { code: "orange", nom: "Orange", detail: "Orange Money" },
  { code: "wave", nom: "Wave", detail: "Wave" },
];

/** Vrai sauf repli explicite vers l'ancien parcours carte + redirection. */
export const CHARGE_DIRECTE_ACTIVE =
  process.env.NEXT_PUBLIC_PAYSTACK_CHARGE_ENABLED !== "0";

/**
 * Le numéro tel que le back l'exige pour la charge : E.164 ivoirien
 * strict, chiffres seuls (`225` suivi de 10 chiffres, sans `+`).
 * `null` pour tout le reste — y compris un E.164 non ivoirien : la charge
 * n'accepte que les numéros ivoiriens.
 */
export function telephoneChargeStrict(e164: string): string | null {
  const chiffres = e164.startsWith("+") ? e164.slice(1) : e164;
  return /^225\d{10}$/.test(chiffres) ? chiffres : null;
}

/**
 * Ce que rend l'initiation d'une charge. `status` est le statut de la
 * réservation (`PENDING`, ou `SUCCESS` si le débit est déjà confirmé) :
 * voir `classeStatutCharge`. Seule la référence est garantie.
 * `authorizationUrl` n'est renseignée que si le back a basculé sur
 * l'ancien flux checkout (charge désactivée côté serveur) : le site
 * redirige alors comme avant au lieu d'attendre ici.
 */
export type ChargeLancee = {
  paymentId?: number;
  reference: string;
  status: string;
  /** La consigne opérateur (`display_text`) : « validez sur votre téléphone ». */
  displayText?: string | null;
  authorizationUrl?: string | null;
};

/**
 * Demande le débit du numéro : `POST initialize` avec le montant (entier
 * XOF, issu du serveur) plus `provider` et `phone` — la même route que
 * l'ancien flux, qui conserve le checkout sans `provider`. `phone` part
 * au format strict `225XXXXXXXXXX` (voir `telephoneChargeStrict`) : c'est
 * le seul que le back accepte.
 */
export async function initieChargeMobile(
  idInscription: number,
  montantXof: number,
  jeton: string,
  operateur: OperateurMobile,
  telephone: string,
): Promise<ChargeLancee> {
  const reponse = await api<Record<string, unknown>>(
    `/payments/enrollments/${idInscription}/initialize`,
    {
      method: "POST",
      jetonSuivi: jeton,
      body: JSON.stringify({
        amountXof: montantXof,
        provider: operateur,
        phone: telephone,
      }),
    },
  );

  const reference =
    typeof reponse.reference === "string" && reponse.reference.length > 0
      ? reponse.reference
      : null;
  if (!reference) {
    throw new Error("Réponse de paiement illisible : référence manquante.");
  }

  const displayText = [
    reponse.displayText,
    reponse.display_text,
    reponse.displayMessage,
  ].find(
    (valeur): valeur is string =>
      typeof valeur === "string" && valeur.length > 0,
  );

  const authorizationUrl =
    typeof reponse.authorizationUrl === "string" &&
    reponse.authorizationUrl.length > 0
      ? reponse.authorizationUrl
      : null;

  return {
    paymentId:
      typeof reponse.paymentId === "number" ? reponse.paymentId : undefined,
    reference,
    status:
      typeof reponse.status === "string" && reponse.status.length > 0
        ? reponse.status
        : "PENDING",
    displayText: displayText ?? null,
    authorizationUrl,
  };
}

/** Le statut d'une charge, ramené à trois issues pour l'affichage. */
export type IssueCharge = "succes" | "attente" | "echec";

/**
 * `SUCCESS` → réglé ; `FAILED` / `ABANDONED` → raté ; tout le reste
 * (`PENDING`, `pay_offline`, statuts intermédiaires) → en attente de la
 * validation sur le téléphone.
 */
export function classeStatutCharge(status: string): IssueCharge {
  if (status === "SUCCESS") return "succes";
  if (status === "FAILED" || status === "ABANDONED") return "echec";
  return "attente";
}

/** La fenêtre laissée pour valider sur le téléphone : 180 s. */
export const FENETRE_CHARGE_MS = 180_000;

/** L'intervalle entre deux vérifications du statut pendant la fenêtre. */
export const INTERVALLE_VERIF_CHARGE_MS = 5_000;

/**
 * Une charge lancée depuis ce navigateur. `reference` est la clé de
 * stockage ; `telephone` est au format strict `225XXXXXXXXXX`, sans PIN
 * ni OTP — on n'en collecte jamais. `initieeA` (`Date.now()`) fait
 * démarrer le compte à rebours.
 */
export type TraceCharge = TracePaiement & {
  operateur: OperateurMobile;
  telephone: string;
  initieeA: number;
};

/** Range la charge (référence + montant + opérateur) : survit à la fermeture. */
export function rangeCharge(reference: string, trace: TraceCharge) {
  ecrit(`${PREFIXE}.charge.${reference}`, JSON.stringify(trace));
  ecrit(`${PREFIXE}.derniere-charge.${trace.idInscription}`, reference);
}

/** La charge d'une référence, ou `null` (trace absente ou illisible). */
export function litCharge(reference: string): TraceCharge | null {
  const brut = lit(`${PREFIXE}.charge.${reference}`);
  if (!brut) return null;

  try {
    const trace = JSON.parse(brut) as Partial<TraceCharge>;
    const operateurValide =
      trace.operateur === "mtn" ||
      trace.operateur === "orange" ||
      trace.operateur === "wave";
    return trace &&
      typeof trace === "object" &&
      typeof trace.jeton === "string" &&
      typeof trace.idInscription === "number" &&
      typeof trace.montantXof === "number" &&
      typeof trace.telephone === "string" &&
      typeof trace.initieeA === "number" &&
      operateurValide
      ? (trace as TraceCharge)
      : null;
  } catch {
    return null;
  }
}

/** La dernière charge de ce dossier sur cet appareil, pour la reprendre. */
export function derniereCharge(idInscription: number): {
  reference: string;
  trace: TraceCharge;
} | null {
  const reference = lit(`${PREFIXE}.derniere-charge.${idInscription}`);
  if (!reference) return null;
  const trace = litCharge(reference);
  return trace ? { reference, trace } : null;
}

/** Oublie la « dernière charge » d'un dossier (réglée, ratée, dépassée). */
export function effaceDerniereCharge(idInscription: number) {
  try {
    localStorage.removeItem(`${PREFIXE}.derniere-charge.${idInscription}`);
  } catch {
    // Stockage indisponible : rien à oublier.
  }
}

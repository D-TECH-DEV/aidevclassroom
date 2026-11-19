"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { CtaButton } from "@/components/ui/CtaButton";
import { ErreurApi, ErreurReseau } from "@/lib/api";
import {
  adressePaiementValide,
  lancePaiement,
  litTrace,
  rangeTrace,
  renvoieRecuParEmail,
  SECOURS_WHATSAPP,
  telechargeRecuPaiement,
  traduitPaiement,
  verifiePaiement,
  type PaiementVerifie,
  type SignatureRecu,
  type TracePaiement,
} from "@/lib/paiement";

/**
 * La page où Paystack renvoie le visiteur, `/paiement/retour?reference=…`.
 *
 * Elle ne croit pas l'adresse. Arriver ici ne veut rien dire : le visiteur
 * a pu payer, abandonner, fermer l'onglet, ou taper l'adresse à la main.
 * La page appelle donc `verify` côté serveur et n'annonce « c'est réglé »
 * que si le serveur le dit.
 *
 * Trois chemins possibles, tous prévus :
 *
 * — **Tout va bien.** La référence est dans l'adresse, le jeton de suivi
 *   est dans ce navigateur, `verify` répond. On affiche le vrai statut.
 *
 * — **Pas de référence.** Quelqu'un est arrivé là par hasard. On le dit
 *   et on le renvoie à l'accueil, sans écran d'erreur alarmant.
 *
 * — **Référence sans jeton.** Le paiement a été lancé depuis un autre
 *   appareil, une navigation privée, ou un stockage vidé depuis. Le site
 *   ne peut pas vérifier — mais le webhook Paystack, lui, met le statut à
 *   jour sans nous. On le dit franchement et on donne WhatsApp, plutôt que
 *   d'afficher un échec qui n'en est pas un.
 *
 * Le bouton de reprise sert au `502` : Paystack injoignable côté serveur
 * est temporaire, et c'est la seule erreur où réessayer a un sens.
 */

type Etat =
  | { phase: "sans-reference" }
  | { phase: "sans-jeton"; reference: string }
  | { phase: "verification"; reference: string }
  | {
      phase: "verifie";
      reference: string;
      paiement: PaiementVerifie;
      trace: TracePaiement;
      lectureSeule: boolean;
      signature?: SignatureRecu;
    }
  | { phase: "erreur"; reference: string; message: string; reprenable: boolean };

function Cadre({
  ton = "neutre",
  children,
}: {
  /** Le vert ne sert qu'au succès : ailleurs il dirait l'inverse du texte. */
  ton?: "succes" | "neutre";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-[clamp(0.75rem,2svh,1.25rem)]
                  rounded-card border bg-surface text-center
                  px-[clamp(1.5rem,5vw,3.5rem)]
                  py-[clamp(2rem,6svh,3.5rem)]
                  ${ton === "succes" ? "border-accent/60" : "border-fg/15"}`}
    >
      {children}
    </div>
  );
}

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="max-w-[18ch] text-h2 font-bold leading-[1.1] tracking-tight">
      {children}
    </h1>
  );
}

function Texte({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[46ch] text-body text-fg/70">{children}</p>;
}

/** La référence affichée pour le suivi du paiement. */
function Reference({
  reference,
  libelle = "Référence",
}: {
  reference: string;
  libelle?: string;
}) {
  return (
    <p className="font-mono text-small text-fg/45">
      {libelle} : <span className="select-all text-fg/70">{reference}</span>
    </p>
  );
}

export function RetourPaiement() {
  const parametres = useSearchParams();
  const reference = parametres.get("reference") ?? parametres.get("trxref");
  const sigParam = parametres.get("sig");
  const expParam = parametres.get("exp");

  const [etat, setEtat] = useState<Etat>(() =>
    reference ? { phase: "verification", reference } : { phase: "sans-reference" },
  );

  // Le complément : le visiteur revient avec le reste à payer. Même
  // garde-fou que le premier versement, et la trace du nouveau paiement
  // rangée avant de partir — sans elle, le retour ne remonterait pas.
  const [complementEnCours, setComplementEnCours] = useState(false);
  const [erreurComplement, setErreurComplement] = useState<string | null>(null);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [envoiMailEnCours, setEnvoiMailEnCours] = useState(false);
  const [messageRecu, setMessageRecu] = useState<string | null>(null);

  async function paieReste() {
    if (etat.phase !== "verifie" || etat.lectureSeule || complementEnCours) return;
    const reste = etat.paiement.remainingAmountXof;
    if (reste === undefined || reste <= 0) return;

    setComplementEnCours(true);
    setErreurComplement(null);

    try {
      const lance = await lancePaiement(
        etat.trace.idInscription,
        reste,
        etat.trace.jeton,
      );

      if (!adressePaiementValide(lance.authorizationUrl)) {
        throw new Error(`adresse de paiement inattendue : ${lance.authorizationUrl}`);
      }

      rangeTrace(lance.reference, { ...etat.trace, montantXof: reste });

      window.location.href = lance.authorizationUrl;
    } catch (cause) {
      setComplementEnCours(false);
      setErreurComplement(traduitPaiement(cause));
    }
  }

  const verifie = useCallback(async () => {
    if (!reference) return;

    // Le `localStorage` ne se lit pas pendant le rendu serveur : cette
    // fonction ne tourne que dans un effet, donc après l'hydratation.
    const traceLocale = litTrace(reference);
    const jeton = traceLocale?.jeton ?? null;
    const signature =
      !jeton && sigParam?.trim() && expParam?.trim()
        ? { sig: sigParam.trim(), exp: expParam.trim() }
        : undefined;

    if (!jeton && !signature) {
      setEtat({ phase: "sans-jeton", reference });
      return;
    }

    setEtat({ phase: "verification", reference });

    try {
      const paiement = await verifiePaiement(reference, jeton, signature);
      const idInscription =
        traceLocale?.idInscription ?? paiement.enrollmentId ?? 0;
      const trace: TracePaiement = traceLocale ?? {
        idInscription: Number.isFinite(idInscription) ? idInscription : 0,
        jeton: "",
        prenom: "",
        montantXof: paiement.amountXof ?? 0,
      };
      setEtat({
        phase: "verifie",
        reference,
        paiement,
        trace,
        lectureSeule: !jeton,
        signature,
      });
    } catch (cause) {
      setEtat({
        phase: "erreur",
        reference,
        message: traduitPaiement(cause),
        // Deux erreurs seulement méritent un bouton « réessayer » : un
        // Paystack injoignable côté serveur, et un réseau qui a lâché de
        // notre côté. Les autres ne changeront pas d'avis si on insiste.
        reprenable:
          cause instanceof ErreurReseau ||
          (cause instanceof ErreurApi && cause.code === "PAYSTACK_VERIFY_FAILED"),
      });
    }
  }, [reference, sigParam, expParam]);

  useEffect(() => {
    void verifie();
  }, [verifie]);

  if (etat.phase === "sans-reference") {
    return (
      <Cadre>
        <Titre>Il n&apos;y a rien à confirmer ici.</Titre>
        <Texte>
          Cette page affiche le résultat d&apos;un paiement. On y arrive
          depuis Paystack, à la fin d&apos;une réservation.
        </Texte>
        <CtaButton href="/">Retour à l&apos;accueil</CtaButton>
      </Cadre>
    );
  }

  if (etat.phase === "verification") {
    return (
      <Cadre>
        <Titre>On vérifie ton paiement…</Titre>
        <Texte>
          Quelques secondes. Ne ferme pas cette page et ne repaie pas.
        </Texte>
        <Reference reference={etat.reference} />
      </Cadre>
    );
  }

  if (etat.phase === "sans-jeton") {
    return (
      <Cadre>
        <Titre>Ce navigateur ne peut pas vérifier ce paiement.</Titre>
        <Texte>
          La clé de ton dossier est restée sur l&apos;appareil où tu as
          réservé. Si tu as payé, c&apos;est enregistré chez Paystack et ton
          inscription se met à jour toute seule — on ne peut simplement pas
          te le montrer ici.
        </Texte>
        <Texte>
          Envoie-nous la référence ci-dessous et on confirme à la main.{" "}
          {SECOURS_WHATSAPP}
        </Texte>
        <Reference reference={etat.reference} />
        <CtaButton href="/">Retour à l&apos;accueil</CtaButton>
      </Cadre>
    );
  }

  if (etat.phase === "erreur") {
    return (
      <Cadre>
        <Titre>On n&apos;a pas pu confirmer.</Titre>
        <Texte>{etat.message}</Texte>
        <Reference reference={etat.reference} />
        {etat.reprenable ? (
          <CtaButton type="button" onClick={() => void verifie()}>
            Réessayer
          </CtaButton>
        ) : (
          <CtaButton href="/">Retour à l&apos;accueil</CtaButton>
        )}
      </Cadre>
    );
  }

  const { paiement, trace, lectureSeule, signature } = etat;

  if (paiement.status === "SUCCESS") {
    // L'API renvoie le solde de l'inscription, pas celui du versement :
    // un versement peut réussir sans solder le dossier. Annoncer
    // « c'est réglé » avec un reste affiché juste en dessous dirait deux
    // choses contraires dans le même cadre.
    const reste = paiement.remainingAmountXof;
    const solde = reste === undefined || reste === 0;

    const refCourante = etat.reference;

    async function telecharge() {
      if (telechargementEnCours) return;
      setTelechargementEnCours(true);
      setMessageRecu(null);
      try {
        await telechargeRecuPaiement(
          refCourante,
          lectureSeule ? null : trace.jeton,
          signature,
        );
      } catch {
        setMessageRecu("Impossible de télécharger le reçu pour le moment.");
      } finally {
        setTelechargementEnCours(false);
      }
    }

    async function renvoieMail() {
      if (envoiMailEnCours || lectureSeule || !trace.jeton) return;
      setEnvoiMailEnCours(true);
      setMessageRecu(null);
      try {
        const res = await renvoieRecuParEmail(refCourante, trace.jeton);
        setMessageRecu(
          res.sent
            ? `Reçu envoyé par e-mail à ${res.email}.`
            : "Envoi d'e-mail indisponible pour le moment (vérifie la configuration Resend).",
        );
      } catch {
        setMessageRecu("Impossible d'envoyer le reçu par e-mail pour le moment.");
      } finally {
        setEnvoiMailEnCours(false);
      }
    }

    return (
      <Cadre ton="succes">
        <Titre>
          {solde
            ? trace.prenom
              ? `C'est réglé, ${trace.prenom}.`
              : "C'est réglé."
            : trace.prenom
              ? `Paiement reçu, ${trace.prenom}.`
              : "Paiement reçu."}
        </Titre>
        <Texte>
          {solde
            ? "Ta place est confirmée. On te retrouve le jour J."
            : `Il reste ${reste.toLocaleString("fr-FR")} FCFA à verser pour confirmer ta place.`}
        </Texte>
        <p className="font-mono text-xs text-fg/65">
          {trace.email
            ? `Un reçu officiel PDF a été envoyé à ${trace.email}.`
            : "Un reçu officiel PDF est envoyé automatiquement à ton adresse e-mail."}
        </p>
        <Reference
          reference={paiement.logicalReference ?? etat.reference}
          libelle="Référence de paiement"
        />

        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <CtaButton
              type="button"
              variante="vert"
              taille="sm"
              pleineLargeur
              disabled={telechargementEnCours}
              onClick={() => void telecharge()}
            >
              {telechargementEnCours
                ? "Téléchargement…"
                : "Télécharger mon reçu (PDF)"}
            </CtaButton>
          </div>
          {!lectureSeule && trace.jeton ? (
            <button
              type="button"
              disabled={envoiMailEnCours}
              onClick={() => void renvoieMail()}
              className="shrink-0 rounded-pill border border-fg/25 px-6 py-3 font-mono text-small
                         font-semibold text-fg/85 transition-colors
                         hoverable:hover:border-accent/60 hoverable:hover:text-accent
                         disabled:opacity-50"
            >
              {envoiMailEnCours ? "Envoi…" : "Renvoyer par e-mail"}
            </button>
          ) : null}
        </div>

        {messageRecu ? (
          <p role="status" className="font-mono text-small text-accent">
            {messageRecu}
          </p>
        ) : null}

        {solde ? (
          <CtaButton href="/" taille="sm">
            Retour à l&apos;accueil
          </CtaButton>
        ) : lectureSeule ? (
          <CtaButton href="/paiement/reprendre" taille="sm">
            Régler le reste (vérification par code)
          </CtaButton>
        ) : (
          <>
            <CtaButton
              type="button"
              onClick={() => void paieReste()}
              disabled={complementEnCours}
              taille="sm"
            >
              {complementEnCours
                ? "Ouverture du paiement…"
                : `Régler le reste — ${reste.toLocaleString("fr-FR")} FCFA`}
            </CtaButton>
            {erreurComplement ? (
              <p role="alert" className="text-small font-medium text-fg">
                {erreurComplement}
              </p>
            ) : null}
            <CtaButton href="/paiement/reprendre" taille="sm">
              Je paierai plus tard
            </CtaButton>
          </>
        )}
      </Cadre>
    );
  }

  if (paiement.status === "PENDING") {
    return (
      <Cadre>
        <Titre>Ton paiement n&apos;est pas encore confirmé.</Titre>
        <Texte>
          Paystack ne l&apos;a pas encore validé. Si tu viens de payer, c&apos;est
          normal : ça prend parfois une minute. Recharge cette page dans un
          instant, ou garde la référence sous la main.
        </Texte>
        <Reference
          reference={paiement.logicalReference ?? etat.reference}
          libelle="Référence de paiement"
        />
        <CtaButton type="button" onClick={() => void verifie()}>
          Vérifier à nouveau
        </CtaButton>
      </Cadre>
    );
  }

  // FAILED, ABANDONED : rien n'a été encaissé, la place est toujours là.
  return (
    <Cadre>
      <Titre>Le paiement n&apos;est pas passé.</Titre>
      <Texte>
        Rien n&apos;a été débité et ton inscription est toujours enregistrée.
        Tu peux réessayer depuis l&apos;accueil, ou nous écrire. {SECOURS_WHATSAPP}
      </Texte>
      <Reference reference={etat.reference} />
      <CtaButton href="/">Retour à l&apos;accueil</CtaButton>
    </Cadre>
  );
}

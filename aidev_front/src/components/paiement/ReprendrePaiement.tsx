"use client";

import { useEffect, useState } from "react";

import { ErreurApi } from "@/lib/api";
import { ChampTelephone } from "@/components/inscription/ChampTelephone";
import { normaliseTelephone } from "@/components/inscription/FormulaireInscription";
import { useOuvrirInscription } from "@/components/inscription/ModaleInscription";
import { CtaButton } from "@/components/ui/CtaButton";
import {
  ParcoursPaiement,
  type DossierAPayer,
} from "@/components/inscription/ParcoursPaiement";
import {
  adressePaiementValide,
  dossiersLocaux,
  lancePaiement,
  ouvrePopupPaystack,
  rangeTrace,
  retrouveDossiersParContact,
  SECOURS_WHATSAPP,
  statutInscription,
  traduitPaiement,
  verifiePaiement,
  type DossierLocal,
  type DossierSuivi,
} from "@/lib/paiement";
import { notifyInscriptionMaj } from "@/lib/usePlacesSprint";

/**
 * « Reprendre mon paiement », `/paiement/reprendre`.
 *
 * Le parcours d'après, en un clic : la page retrouve toute seule les
 * dossiers ouverts sur cet appareil, affiche chaque reste à payer, et
 * chacun se paie — en charge mobile money directe (`ParcoursPaiement`,
 * sans redirection) quand `CHARGE_DIRECTE_ACTIVE`, sinon comme avant
 * (même `initialize`, même redirection Paystack, même page de retour).
 * Pas de formulaire, pas d'e-mail à retaper : un bouton y mène, le reste
 * s'affiche, on paie.
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

export function ReprendrePaiement({ onFermer }: { onFermer?: () => void } = {}) {
  const ouvreInscription = useOuvrirInscription();
  const [etat, setEtat] = useState<Etat>({ phase: "recherche" });
  const [dossierAnnuleDetecte, setDossierAnnuleDetecte] = useState(false);
  // Un paiement en cours par dossier : deux lignes n'attendent jamais
  // ensemble, chacune porte son propre état.
  const [enCours, setEnCours] = useState<Record<number, boolean>>({});
  const [erreurs, setErreurs] = useState<Record<number, string>>({});
  // Recherche par e-mail ou téléphone : pour un autre appareil ou un oubli d'e-mail.
  const [modeRecherche, setModeRecherche] = useState<"email" | "telephone">("email");
  const [email, setEmail] = useState("");
  const [indicatifTel, setIndicatifTel] = useState("+225");
  const [telephone, setTelephone] = useState("");
  const [rechercheEmail, setRechercheEmail] = useState(false);
  const [erreurEmail, setErreurEmail] = useState<string | null>(null);
  const [retrouves, setRetrouves] = useState<number | null>(null);
  // Le dossier dont on paie le reste en charge directe : le parcours à
  // étapes remplace alors la liste, avec retour ici (« Précédent »).
  const [chargeDossier, setChargeDossier] = useState<DossierAPayer | null>(
    null,
  );

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
    const actifs = affiches.filter((d) => d.suivi?.status !== "CANCELLED");
    const aUnAnnule = affiches.some((d) => d.suivi?.status === "CANCELLED");
    setDossierAnnuleDetecte(aUnAnnule);
    if (actifs.length === 0) return { phase: "vide" };
    return { phase: "liste", dossiers: actifs };
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

    let payload: { email?: string; phone?: string };
    if (modeRecherche === "email") {
      const propre = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(propre)) {
        setErreurEmail("Cette adresse e-mail n'est pas valide.");
        return;
      }
      payload = { email: propre };
    } else {
      const normalise = normaliseTelephone(`${indicatifTel} ${telephone}`);
      if (!normalise) {
        setErreurEmail(
          telephone.trim()
            ? "Numéro incomplet. Dix chiffres, ou l'indicatif du pays."
            : "Saisis ton numéro de téléphone.",
        );
        return;
      }
      payload = { phone: normalise };
    }

    setRechercheEmail(true);
    setErreurEmail(null);
    setRetrouves(null);
    try {
      const dossiers = await retrouveDossiersParContact(payload);
      setRetrouves(dossiers.length);
      if (dossiers.length === 0) {
        setErreurEmail(
          "Aucun dossier actif trouvé. Si ton inscription a été annulée, reprends une nouvelle inscription.",
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

      await ouvrePopupPaystack(lance.accessCode, lance.authorizationUrl, {
        onSuccess: (ref) => {
          const refFinale = ref || lance.reference;
          void verifiePaiement(refFinale, dossier.local.jeton)
            .then(async () => {
              notifyInscriptionMaj();
              setEtat(await charge());
            })
            .catch((cause) => {
              setErreurs((v) => ({
                ...v,
                [dossier.local.idInscription]: traduitPaiement(cause),
              }));
            })
            .finally(() => {
              setEnCours((v) => ({
                ...v,
                [dossier.local.idInscription]: false,
              }));
            });
        },
        onCancel: () => {
          setEnCours((v) => ({
            ...v,
            [dossier.local.idInscription]: false,
          }));
          setErreurs((v) => ({
            ...v,
            [dossier.local.idInscription]:
              "Paiement annulé. Tu peux réessayer quand tu es prêt.",
          }));
        },
        onError: () => {
          setEnCours((v) => ({
            ...v,
            [dossier.local.idInscription]: false,
          }));
          setErreurs((v) => ({
            ...v,
            [dossier.local.idInscription]:
              "Le paiement n'a pas pu aboutir. Réessaie.",
          }));
        },
      });
    } catch (cause) {
      setEnCours((v) => ({ ...v, [dossier.local.idInscription]: false }));
      setErreurs((v) => ({
        ...v,
        [dossier.local.idInscription]: traduitPaiement(cause),
      }));
    }
  }

  // Le reste se paie dans le même parcours qu'à l'inscription : mêmes
  // étapes, mêmes messages, reprise d'une charge en cours incluse (le
  // parcours relit la dernière charge du dossier). « Précédent » revient
  // ici et rafraîchit les soldes.
  if (chargeDossier) {
    return (
      <ParcoursPaiement
        key={`reprendre-${chargeDossier.idInscription}`}
        dossier={chargeDossier}
        onPrecedent={() => {
          setChargeDossier(null);
          void charge().then(setEtat);
        }}
      />
    );
  }

  if (etat.phase === "recherche") {
    return (
      <Cadre>
        <Titre>On cherche tes dossiers…</Titre>
        <Texte>Quelques secondes.</Texte>
      </Cadre>
    );
  }

  function BlocEmail({ titre, description }: { titre: string; description: string }) {
    return (
      <form
        onSubmit={(e) => void recupereParEmail(e)}
        className="rounded-card border border-fg/15 bg-surface
                   px-[clamp(1.25rem,3vw,2rem)] py-[clamp(1.25rem,3svh,2rem)]
                   text-left"
      >
        <p className="text-h3 font-bold leading-tight tracking-tight">
          {titre}
        </p>
        <p className="mt-2 text-body text-fg/70">
          {description}
        </p>
        <p className="mt-3 rounded-field border border-[#0B63F6]/30 bg-[#0B63F6]/10 px-3.5 py-2.5 text-xs leading-relaxed text-fg/85">
          <strong>Note :</strong> cette option concerne uniquement les personnes
          ayant déjà effectué un paiement partiel pour leur adhésion.
        </p>

        <div
          role="tablist"
          aria-label="Méthode de recherche"
          className="mt-4 grid grid-cols-2 gap-2 rounded-field border border-fg/15 bg-bg p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={modeRecherche === "email"}
            onClick={() => {
              setModeRecherche("email");
              setErreurEmail(null);
            }}
            className={`rounded-field py-2 text-small font-semibold transition-colors ${
              modeRecherche === "email"
                ? "bg-[#0B63F6] text-fg"
                : "text-fg/65 hoverable:hover:text-fg"
            }`}
          >
            Par e-mail
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modeRecherche === "telephone"}
            onClick={() => {
              setModeRecherche("telephone");
              setErreurEmail(null);
            }}
            className={`rounded-field py-2 text-small font-semibold transition-colors ${
              modeRecherche === "telephone"
                ? "bg-[#0B63F6] text-fg"
                : "text-fg/65 hoverable:hover:text-fg"
            }`}
          >
            Par téléphone
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {modeRecherche === "email" ? (
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
          ) : (
            <ChampTelephone
              nom="rechercheTelephone"
              etiquette="Numéro WhatsApp utilisé"
              indicatif={indicatifTel}
              onChangeIndicatif={setIndicatifTel}
              valeur={telephone}
              onChange={setTelephone}
              placeholder="07 04 92 10 80"
            />
          )}
          <button
            type="submit"
            disabled={rechercheEmail}
            className="inline-flex w-full shrink-0 items-center justify-center
                       rounded-pill border-2 border-cta px-8 py-3
                       text-body font-bold transition-transform
                       duration-[120ms] active:scale-[0.96]
                       disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rechercheEmail ? "Recherche…" : "Retrouver mon dossier"}
          </button>
        </div>
        {erreurEmail ? (
          <div role="alert" className="mt-3 space-y-3">
            <p className="text-small font-medium text-fg">{erreurEmail}</p>
            {ouvreInscription ? (
              <CtaButton
                type="button"
                variante="vert"
                taille="sm"
                pleineLargeur
                onClick={() => {
                  onFermer?.();
                  ouvreInscription();
                }}
              >
                Reprendre mon inscription
              </CtaButton>
            ) : (
              <CtaButton href="/" variante="vert" taille="sm" pleineLargeur>
                Reprendre mon inscription
              </CtaButton>
            )}
          </div>
        ) : null}
        {retrouves !== null && !erreurEmail ? (
          <p role="status" className="mt-3 text-small text-fg/70">
            {retrouves === 0
              ? "Aucun dossier retrouvé."
              : `${retrouves} dossier${retrouves > 1 ? "s" : ""} retrouvé${retrouves > 1 ? "s" : ""} : paie juste en dessous.`}
          </p>
        ) : null}
        <p className="mt-4 text-xs text-fg/45">
          Besoin d&apos;aide ? {SECOURS_WHATSAPP}
        </p>
      </form>
    );
  }

  if (etat.phase === "vide") {
    return (
      <div className="flex flex-col gap-4">
        {dossierAnnuleDetecte ? (
          <div className="space-y-3 rounded-card border border-amber-400/35 bg-amber-500/10 p-4 text-left">
            <p className="text-body font-semibold text-fg">
              Ton précédent dossier a été annulé.
            </p>
            <p className="text-small text-fg/75">
              Pour participer au sprint, tu dois reprendre une nouvelle inscription.
            </p>
            {ouvreInscription ? (
              <CtaButton
                type="button"
                variante="vert"
                taille="sm"
                pleineLargeur
                onClick={() => {
                  onFermer?.();
                  ouvreInscription();
                }}
              >
                Reprendre mon inscription
              </CtaButton>
            ) : (
              <CtaButton href="/" variante="vert" taille="sm" pleineLargeur>
                Reprendre mon inscription
              </CtaButton>
            )}
          </div>
        ) : null}
        <BlocEmail
          titre="Retrouver mon inscription"
          description="Saisis l'adresse e-mail ou le numéro de téléphone utilisé lors de ton inscription pour compléter ton paiement."
        />
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
      <BlocEmail
        titre="Un autre dossier ?"
        description="Saisis l'e-mail d'une autre inscription pour la retrouver ici."
      />
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
  const paye = suivi.totalPaidXof ?? Math.max(0, suivi.totalAmountXof - reste);
  const pourcentage =
    suivi.totalAmountXof > 0
      ? Math.min(100, Math.round((paye / suivi.totalAmountXof) * 100))
      : 0;

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
          {paye.toLocaleString("fr-FR")} /{" "}
          {suivi.totalAmountXof.toLocaleString("fr-FR")} FCFA payés ({pourcentage} %)
        </p>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-fg/10">
        <div
          className={`h-full transition-all duration-300 ${
            solde ? "bg-[#2EE66B]" : "bg-[#0B63F6]"
          }`}
          style={{ width: `${pourcentage}%` }}
        />
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
          <p className="mt-1 text-small text-fg/60">
            Statut : en attente de solde (place confirmée dès 100 % payés).
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

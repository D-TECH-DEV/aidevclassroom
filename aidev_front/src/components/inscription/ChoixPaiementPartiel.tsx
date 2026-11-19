"use client";

type Props = {
  minimumXof: number;
  resteXof: number;
  montant: number;
  onChangeMontant: (montant: number) => void;
  conditionsAcceptees: boolean;
  onChangeConditions: (accepte: boolean) => void;
};

/**
 * Sélecteur intuitif : paiement intégral (100 %) ou paiement partiel
 * avec saisie du montant, récapitulatif et approbation obligatoire des
 * conditions de remboursement (« Lu et approuvé »).
 */
export function ChoixPaiementPartiel({
  minimumXof,
  resteXof,
  montant,
  onChangeMontant,
  conditionsAcceptees,
  onChangeConditions,
}: Props) {
  const estPartiel = montant < resteXof;
  const montantBorne = Math.min(Math.max(montant, minimumXof), resteXof);
  const resteApres = Math.max(0, resteXof - montantBorne);
  const moitie = Math.round(resteXof / 2 / 500) * 500;
  const afficheMoitie = moitie > minimumXof && moitie < resteXof;

  function choisisIntegral() {
    onChangeMontant(resteXof);
  }

  function choisisPartiel() {
    const initial = montant < resteXof && montant >= minimumXof ? montant : minimumXof;
    onChangeMontant(initial);
  }

  function changeSaisie(valeurBrute: string) {
    const parsed = Number.parseInt(valeurBrute.replace(/\D/g, ""), 10);
    if (Number.isNaN(parsed)) {
      onChangeMontant(minimumXof);
      return;
    }
    onChangeMontant(Math.min(Math.max(parsed, minimumXof), resteXof));
  }

  return (
    <fieldset className="space-y-4">
      <legend className="font-mono text-small uppercase tracking-[0.15em] text-fg/60">
        Mode de règlement
      </legend>

      <div
        className="grid gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Mode de paiement"
      >
        <button
          type="button"
          role="radio"
          aria-checked={!estPartiel}
          onClick={choisisIntegral}
          className={`rounded-card border px-4 py-3.5 text-left transition-colors duration-[160ms] ${
            !estPartiel
              ? "border-[#2EE66B] bg-[#2EE66B]/10"
              : "border-fg/15 hoverable:hover:border-fg/30"
          }`}
        >
          <span className="block text-body font-bold text-fg">
            Paiement intégral (100 %)
          </span>
          <span className="mt-1 block font-mono text-small font-semibold text-[#2EE66B]">
            {resteXof.toLocaleString("fr-FR")} FCFA
          </span>
          <span className="mt-1.5 block text-xs text-fg/65">
            Place garantie et confirmée immédiatement.
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={estPartiel}
          onClick={choisisPartiel}
          className={`rounded-card border px-4 py-3.5 text-left transition-colors duration-[160ms] ${
            estPartiel
              ? "border-[#0B63F6] bg-[#0B63F6]/10"
              : "border-fg/15 hoverable:hover:border-fg/30"
          }`}
        >
          <span className="block text-body font-bold text-fg">
            Paiement partiel (Acompte)
          </span>
          <span className="mt-1 block font-mono text-small font-semibold text-[#6BA3FF]">
            Dès {minimumXof.toLocaleString("fr-FR")} FCFA
          </span>
          <span className="mt-1.5 block text-xs text-fg/65">
            Place confirmée uniquement une fois soldée à 100 %.
          </span>
        </button>
      </div>

      {estPartiel && (
        <div className="space-y-4 rounded-card border border-[#0B63F6]/35 bg-surface/80 p-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="montant-acompte"
                className="text-small font-semibold text-fg"
              >
                Montant de votre acompte (FCFA)
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onChangeMontant(minimumXof)}
                  className={`rounded-pill border px-2.5 py-1 font-mono text-xs transition-colors ${
                    montantBorne === minimumXof
                      ? "border-[#0B63F6] bg-[#0B63F6]/20 text-fg"
                      : "border-fg/15 text-fg/70 hoverable:hover:border-fg/35"
                  }`}
                >
                  Minimum ({minimumXof.toLocaleString("fr-FR")})
                </button>
                {afficheMoitie && (
                  <button
                    type="button"
                    onClick={() => onChangeMontant(moitie)}
                    className={`rounded-pill border px-2.5 py-1 font-mono text-xs transition-colors ${
                      montantBorne === moitie
                        ? "border-[#0B63F6] bg-[#0B63F6]/20 text-fg"
                        : "border-fg/15 text-fg/70 hoverable:hover:border-fg/35"
                    }`}
                  >
                    50 % ({moitie.toLocaleString("fr-FR")})
                  </button>
                )}
              </div>
            </div>

            <input
              id="montant-acompte"
              type="number"
              inputMode="numeric"
              min={minimumXof}
              max={resteXof}
              step={500}
              value={montantBorne}
              onChange={(e) => changeSaisie(e.target.value)}
              className="w-full rounded-card border border-fg/20 bg-bg px-3.5 py-2.5 font-mono text-body text-fg outline-none focus:border-[#0B63F6]"
            />

            <div className="grid grid-cols-2 gap-3 rounded-card border border-fg/10 bg-bg/60 p-3 text-small">
              <div>
                <span className="block text-xs text-fg/55">Payé aujourd&apos;hui</span>
                <strong className="font-mono text-fg">
                  {montantBorne.toLocaleString("fr-FR")} FCFA
                </strong>
              </div>
              <div>
                <span className="block text-xs text-fg/55">Reste à compléter</span>
                <strong className="font-mono text-[#6BA3FF]">
                  {resteApres.toLocaleString("fr-FR")} FCFA
                </strong>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-card border border-amber-400/35 bg-amber-500/10 p-3.5 text-xs leading-relaxed text-fg/85">
            <p className="font-semibold text-amber-200">
              Conditions du paiement partiel et politique de remboursement
            </p>
            <ul className="list-disc space-y-1.5 pl-4">
              <li>
                <strong>Confirmation à 100 % :</strong> votre inscription reste en
                attente et n&apos;est définitivement confirmée qu&apos;une fois la
                totalité du montant payée.
              </li>
              <li>
                <strong>Si la limite de places est atteinte avant le solde :</strong>{" "}
                seuls les <strong>2/3 du montant déjà versé</strong> vous seront
                remboursés.
              </li>
              <li>
                <strong>Si la limite de places n&apos;est pas atteinte :</strong>{" "}
                nous ne garantissons pas le remboursement de votre acompte. Vous
                pouvez compléter votre paiement à tout moment depuis le bouton{" "}
                <em>« Compléter mon inscription »</em>.
              </li>
            </ul>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-card border border-fg/15 bg-bg/70 p-3 text-small text-fg">
            <input
              type="checkbox"
              checked={conditionsAcceptees}
              onChange={(e) => onChangeConditions(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#0B63F6]"
            />
            <span>
              <strong>Lu et approuvé</strong> — J&apos;ai pris connaissance des
              conditions du paiement partiel et des règles de remboursement
              ci-dessus.
            </span>
          </label>
        </div>
      )}
    </fieldset>
  );
}

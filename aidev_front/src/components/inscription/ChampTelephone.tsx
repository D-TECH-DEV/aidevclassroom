"use client";

import { useId } from "react";

type Props = {
  nom: string;
  etiquette: string;
  indicatif: string;
  onChangeIndicatif: (indicatif: string) => void;
  valeur: string;
  onChange: (valeur: string) => void;
  erreur?: string;
  placeholder?: string;
  autoComplete?: string;
  enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>["enterKeyHint"];
};

/** Nettoie la saisie d'indicatif tout en autorisant sa modification libre. */
export function nettoieIndicatif(saisie: string): string {
  const brut = saisie.trim();
  const chiffres = brut.replace(/\D/g, "").slice(0, 4);
  if (!chiffres && !brut.startsWith("+")) return "";
  return `+${chiffres}`;
}

/** Formate en paires XX XX XX XX XX pour la Côte d'Ivoire (+225). */
export function formateNumeroSelonIndicatif(
  saisie: string,
  indicatif: string,
): string {
  let chiffres = saisie.replace(/\D/g, "");
  const estCI = indicatif.replace(/\D/g, "") === "225";

  if (estCI) {
    if (chiffres.startsWith("225") && chiffres.length === 13) {
      chiffres = chiffres.slice(3);
    }
    return chiffres.slice(0, 10).replace(/(\d{2})(?=\d)/g, "$1 ");
  }

  return chiffres.slice(0, 15).replace(/(\d{2})(?=\d)/g, "$1 ");
}

/**
 * Champ téléphone avec indicatif pays prérempli (`+225`) et modifiable
 * juste avant le numéro.
 */
export function ChampTelephone({
  nom,
  etiquette,
  indicatif,
  onChangeIndicatif,
  valeur,
  onChange,
  erreur,
  placeholder = "07 04 92 10 80",
  autoComplete = "tel-national",
  enterKeyHint,
}: Props) {
  const id = useId();
  const idIndicatif = `${id}-indicatif`;
  const idErreur = `${id}-erreur`;

  const classeChamp = `rounded-field border bg-bg
    px-[clamp(0.875rem,2vw,1.125rem)]
    py-[clamp(0.6875rem,1.6svh,0.9375rem)]
    text-body text-fg transition-colors duration-[160ms]
    placeholder:text-fg/30
    ${erreur ? "border-fg/55" : "border-fg/15"}`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label
        htmlFor={id}
        className="font-mono text-small uppercase tracking-[0.15em] text-fg/60"
      >
        {etiquette}
      </label>

      <div className="flex items-stretch gap-2">
        <input
          id={idIndicatif}
          type="tel"
          inputMode="tel"
          aria-label={`Indicatif pays pour ${etiquette}`}
          value={indicatif}
          onChange={(e) => onChangeIndicatif(nettoieIndicatif(e.target.value))}
          placeholder="+225"
          maxLength={5}
          className={`w-[5.25rem] shrink-0 text-center font-mono ${classeChamp}`}
        />

        <input
          id={id}
          name={nom}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          enterKeyHint={enterKeyHint}
          value={valeur}
          onChange={(e) =>
            onChange(formateNumeroSelonIndicatif(e.target.value, indicatif))
          }
          placeholder={placeholder}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? idErreur : undefined}
          className={`min-w-0 flex-1 ${classeChamp}`}
        />
      </div>

      {erreur && (
        <p id={idErreur} className="text-small font-medium text-fg">
          {erreur}
        </p>
      )}
    </div>
  );
}

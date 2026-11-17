import Link from "next/link";

import { BoutonReserver } from "@/components/inscription/BoutonReserver";
import { EtiquetteSection } from "@/components/ui/EtiquetteSection";
import { A_DETERMINER, type Edition } from "@/lib/edition";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Section — la session mise en avant.
 *
 * La promesse à gauche, les étapes du programme à droite, puis la
 * barre de faits : date, lieu, niveau, prix, places, et les deux façons
 * de réserver.
 *
 * Aucun fait n'est écrit en dur : tout vient de l'édition et de la
 * configuration globale. Un champ non arrêté s'affiche [À DÉTERMINER].
 */

const DEFAUT_WHATSAPP_AFFICHE = "07 04 92 10 80";
const DEFAUT_WHATSAPP_LIEN = "https://wa.me/2250704921080";

function Fait({
  etiquette,
  valeur,
  precision,
  determine = true,
}: {
  etiquette: string;
  valeur: string;
  precision?: string | null;
  determine?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[clamp(0.5rem,1.2svh,0.75rem)]">
      <p className="font-mono text-small font-bold uppercase tracking-[0.15em] text-accent">
        {etiquette}
      </p>
      <p
        className={`text-h3 font-bold leading-tight tracking-tight ${
          determine ? "" : "font-mono text-accent/70"
        }`}
      >
        {valeur}
      </p>
      {precision && <p className="text-small text-fg/60">{precision}</p>}
    </div>
  );
}

export function Session({
  edition,
  whatsappAffiche = DEFAUT_WHATSAPP_AFFICHE,
  whatsappLien = DEFAUT_WHATSAPP_LIEN,
}: {
  edition: Edition | null;
  whatsappAffiche?: string;
  whatsappLien?: string;
}) {
  if (!edition) {
    return (
      <section
        id="session"
        className="relative isolate overflow-hidden py-[clamp(4rem,12svh,9rem)]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage: [
              "radial-gradient(70% 90% at 8% 25%, color-mix(in oklab, var(--color-glow-green) 42%, transparent) 0%, transparent 60%)",
              "radial-gradient(60% 80% at 95% 95%, color-mix(in oklab, var(--color-glow-blue) 65%, transparent) 0%, transparent 60%)",
            ].join(", "),
          }}
        />
        <Reveal className="shell">
          <div className="max-w-[54ch] rounded-card border border-fg/15 bg-bg/60 p-[clamp(1.5rem,3vw,2.5rem)]">
            <EtiquetteSection>Prochaine session</EtiquetteSection>
            <h2 className="mt-[clamp(1rem,3svh,1.75rem)] text-h1 font-bold leading-[1.05] tracking-tighter">
              Aucune session active pour le moment.
            </h2>
            <p className="mt-[clamp(1rem,2.5svh,1.5rem)] text-body text-fg/70">
              Les prochaines dates, le lieu et le programme détaillé seront
              publiés ici dès l&apos;ouverture du prochain sprint.
            </p>
            <div className="mt-[clamp(1.5rem,4svh,2.25rem)] flex flex-wrap items-center gap-4">
              <Link
                href={whatsappLien}
                target="_blank"
                rel="noopener noreferrer"
                className="text-small text-fg/75 underline decoration-fg/30
                           underline-offset-4 transition-colors hover:text-accent"
              >
                Nous contacter sur WhatsApp ({whatsappAffiche})
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    );
  }

  const etapes = edition.modules;
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(edition.dateDebut));

  const prix =
    edition.prixDuoFCFA != null
      ? `Solo ${edition.prixFCFA.toLocaleString("fr-FR")} · Duo ${edition.prixDuoFCFA.toLocaleString("fr-FR")} FCFA`
      : `${edition.prixFCFA.toLocaleString("fr-FR")} FCFA`;

  return (
    <section
      id="session"
      className="relative isolate overflow-hidden py-[clamp(4rem,12svh,9rem)]"
    >
      {/* La lumière de la section : vert à gauche, bleu à droite. Ce n'est
          pas un fond de carte, c'est ce qui éclaire le bloc. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: [
            "radial-gradient(70% 90% at 8% 25%, color-mix(in oklab, var(--color-glow-green) 42%, transparent) 0%, transparent 60%)",
            "radial-gradient(60% 80% at 95% 95%, color-mix(in oklab, var(--color-glow-blue) 65%, transparent) 0%, transparent 60%)",
          ].join(", "),
        }}
      />

      <Reveal className="shell">
        <div className="grid gap-[clamp(2.5rem,6svh,4rem)] lg:grid-cols-2 lg:items-center lg:gap-[clamp(2rem,5vw,5rem)]">
          <div>
            <EtiquetteSection>
              {edition.format !== A_DETERMINER
                ? edition.format
                : "Session ouverte"}
            </EtiquetteSection>

            <h2 className="mt-[clamp(1rem,3svh,2rem)] max-w-[16ch] text-h1 font-bold leading-[1.02] tracking-tighter">
              {edition.nom}
            </h2>

            {edition.description ? (
              <p className="mt-[clamp(1rem,2.5svh,1.75rem)] max-w-[52ch] text-body text-fg/70">
                {edition.description}
              </p>
            ) : null}
          </div>

          {etapes.length > 0 ? (
            <ol className="flex flex-col gap-[clamp(0.625rem,1.5svh,1rem)]">
              {etapes.map((temps, i) => (
                <li
                  key={`${temps}-${i}`}
                  className="flex items-center gap-[clamp(0.75rem,1.5vw,1.25rem)]
                             rounded-pill border border-fg/15 bg-bg/40
                             px-[clamp(0.75rem,1.5vw,1.25rem)]
                             py-[clamp(0.625rem,1.6svh,1rem)]
                             transition-colors duration-[200ms]
                             ease-[var(--ease-out-strong)]
                             hoverable:hover:border-accent/50"
                >
                  <span
                    aria-hidden
                    className="grid size-[clamp(1.75rem,4svh,2.5rem)] shrink-0
                               place-items-center rounded-pill bg-accent
                               font-mono text-small font-bold text-on-accent"
                  >
                    {i + 1}
                  </span>
                  <span className="text-body font-bold tracking-tight">
                    {temps}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-card border border-fg/15 bg-bg/40 p-6 font-mono text-small text-fg/60">
              Le programme détaillé de cette session sera précisé prochainement.
            </div>
          )}
        </div>

        {/* ── La barre de faits ─────────────────────────────────────── */}
        <div
          className="mt-[clamp(2.5rem,8svh,5rem)] rounded-card border
                     border-fg/15 bg-bg/60 p-[clamp(1.5rem,3vw,2.5rem)]"
        >
          <div className="grid gap-[clamp(1.5rem,3svh,2rem)] sm:grid-cols-2 xl:grid-cols-4">
            <Fait etiquette="Date" valeur={date} determine={edition !== null} />
            <Fait
              etiquette="Lieu"
              valeur={
                edition && edition.ville !== A_DETERMINER
                  ? edition.ville
                  : "À annoncer"
              }
              precision={
                edition && edition.lieu !== A_DETERMINER ? edition.lieu : null
              }
              determine={Boolean(edition && edition.ville !== A_DETERMINER)}
            />
            <Fait
              etiquette="Niveau"
              valeur={
                edition && edition.niveau !== A_DETERMINER
                  ? edition.niveau
                  : "Bases en dev"
              }
              determine={Boolean(edition && edition.niveau !== A_DETERMINER)}
            />
            <Fait etiquette="Prix" valeur={prix} determine={edition !== null} />
          </div>

          <hr className="my-[clamp(1.5rem,4svh,2.5rem)] border-fg/15" />

          <div className="flex flex-col gap-[clamp(1rem,2.5svh,1.5rem)] lg:flex-row lg:items-center lg:justify-between">
            <p className="text-body text-fg/70">
              Places limitées ·{" "}
              <span
                className={
                  edition?.quota != null
                    ? "font-bold text-fg"
                    : "font-mono text-accent/70"
                }
              >
                {edition?.quota != null
                  ? `${edition.quota} places`
                  : "À confirmer"}
              </span>
            </p>

            <div className="flex flex-col gap-[clamp(0.75rem,2svh,1rem)] sm:flex-row sm:items-center">
              <Link
                href={whatsappLien}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-pill
                           border border-fg/20 px-[clamp(1.25rem,2.5vw,2rem)]
                           py-[clamp(0.75rem,1.8svh,1rem)] text-body
                           transition-[color,border-color,transform]
                           duration-[200ms] ease-[var(--ease-out-strong)]
                           hoverable:hover:border-accent
                           active:scale-[0.97]"
              >
                WhatsApp · {whatsappAffiche}
              </Link>

              <BoutonReserver />
            </div>

            {/* Le parcours de reprise vit à `/paiement/reprendre` : un
                déjà-inscrit avec un acompte y voit son reste et le paie.
                Discret — la décision première reste Réserver. */}
            <p className="mt-[clamp(0.75rem,2svh,1rem)] text-small text-fg/60">
              Déjà inscrit avec un acompte ?{" "}
              <Link
                href="/paiement/reprendre"
                className="text-fg underline decoration-fg/25
                           underline-offset-4 outline-none
                           focus-visible:text-fg hoverable:hover:text-fg"
              >
                Voir mon reste à payer →
              </Link>
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

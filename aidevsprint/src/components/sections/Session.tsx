import Link from "next/link";

import { BoutonReserver } from "@/components/inscription/BoutonReserver";
import { EtiquetteSection } from "@/components/ui/EtiquetteSection";
import { FAITS_LOCAUX, type Edition } from "@/lib/edition";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Section — la session #1.
 *
 * Transcription du design `Landing — ai-dev-sprint.com@2x.png`.
 * La promesse à gauche, les quatre temps de la journée à droite, puis la
 * barre de faits : date, lieu, niveau, prix, places, et les deux façons
 * de réserver. C'est la section qui décide : tout ce qu'il faut savoir y
 * tient sans défiler plus loin.
 *
 * La lueur verte → bleue traverse toute la section. C'est le dégradé
 * signature de l'affiche, employé comme source de lumière et non comme
 * fond de carte.
 *
 * Aucun fait n'est écrit en dur : tout vient de l'édition. Un champ non
 * arrêté n'est jamais comblé par une valeur plausible : la barre de
 * faits écrit « À annoncer », l'étiquette perd le nom de la session, et
 * le compteur de places disparaît. Rien n'est inventé, rien n'affiche
 * non plus un marqueur de chantier au visiteur.
 */

const TEMPS = [
  "Le design de ton site",
  "Le code, en guidant l'IA",
  "Ton admin + ton chatbot IA",
  "Ton site déployé en ligne",
];

/* Le brief donne le numéro au format local : 07 04 92 10 80. `wa.me`
   exige l'international sans espaces — la Côte d'Ivoire est en +225.
   À confirmer par Malik avant mise en ligne. */
const WHATSAPP_AFFICHE = "07 04 92 10 80";
const WHATSAPP_LIEN = "https://wa.me/2250704921080";

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

export function Session({ edition }: { edition: Edition | null }) {
  const date = edition
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(edition.dateDebut))
    : "À annoncer";

  const prix = edition
    ? edition.prixDuoFCFA != null
      ? `Solo ${edition.prixFCFA.toLocaleString("fr-FR")} · Duo ${edition.prixDuoFCFA.toLocaleString("fr-FR")} FCFA`
      : `${edition.prixFCFA.toLocaleString("fr-FR")} FCFA`
    : "À annoncer";

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
              {edition?.nom ? `${edition.nom} · ` : ""}
              {FAITS_LOCAUX.format}
            </EtiquetteSection>

            <h2 className="mt-[clamp(1rem,3svh,2rem)] max-w-[14ch] text-h1 font-bold leading-[1.02] tracking-tighter">
              Repars avec ton <em>portfolio</em>{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-signature)" }}
              >
                en ligne
              </span>
              .
            </h2>

            <p className="mt-[clamp(1rem,2.5svh,1.75rem)] max-w-[52ch] text-body text-fg/70">
              En une journée, tu conçois, codes et déploies ton propre site avec
              l&apos;IA, en suivant notre méthode de bout en bout.
            </p>
          </div>

          {/* Les quatre temps. Une liste ordonnée : l'ordre est le propos. */}
          <ol className="flex flex-col gap-[clamp(0.625rem,1.5svh,1rem)]">
            {TEMPS.map((temps, i) => (
              <li
                key={temps}
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
              valeur={FAITS_LOCAUX.ville}
              precision={FAITS_LOCAUX.lieu}
            />
            <Fait etiquette="Niveau" valeur="Bases en dev" />
            <Fait etiquette="Prix" valeur={prix} determine={edition !== null} />
          </div>

          <hr className="my-[clamp(1.5rem,4svh,2.5rem)] border-fg/15" />

          <div className="flex flex-col gap-[clamp(1rem,2.5svh,1.5rem)] lg:flex-row lg:items-center lg:justify-between">
            <p className="text-body text-fg/70">
              Places limitées
              {edition?.quota != null && (
                <>
                  {" · "}
                  <span className="font-bold text-fg">
                    {edition.quota} places
                  </span>
                </>
              )}
            </p>

            <div className="flex flex-col gap-[clamp(0.75rem,2svh,1rem)] sm:flex-row sm:items-center">
              <Link
                href={WHATSAPP_LIEN}
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
                WhatsApp · {WHATSAPP_AFFICHE}
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

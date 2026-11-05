import { A_DETERMINER, FAITS_LOCAUX, type Edition } from "@/lib/edition";
import type { ReactNode } from "react";

/**
 * La card d'informations du hero : quand, à quelle heure, où.
 *
 * Remplace la ligne « Formation · format · lieu » posée le 2026-10-19 : en
 * texte courant, ces faits se lisaient comme une légende, pas comme l'offre.
 *
 * Les trois faits ont été arrêtés par Malik le 2026-10-20 — date, heure,
 * lieu. « Nature » et « format » en sont sortis : ce sont des précisions,
 * pas les trois questions que se pose quelqu'un qui hésite à venir.
 *
 * Aucun survol : rien n'y est cliquable, et un survol promettrait une
 * action qui n'existe pas.
 */

/* ── Couleur ───────────────────────────────────────────────────────────
 * Cadre vert, glyphes dans le bleu du bouton, fond presque noir. Arrêté
 * par Malik le 2026-10-20, après un essai en bleu profond écarté.
 *
 * Le fond n'est pas tout à fait transparent : l'aurore passe derrière le
 * hero, et sur ses zones claires le texte perdait son contraste. Un voile
 * noir à 55 % suffit à le tenir sans refermer la card.
 */
const FOND = "color-mix(in oklab, var(--color-bg) 55%, transparent)";

/**
 * Les glyphes sont dessinés, pas importés. `docs/design.md` écarte les
 * « icônes génériques », et les 4 temps juste à côté utilisent déjà cette
 * grille : même boîte 24×24, même trait de 1.75, mêmes extrémités rondes.
 */
const Glyphe = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className="size-[clamp(0.9375rem,1.05vw,1.125rem)] shrink-0 stroke-current"
    fill="none"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

/** Un calendrier : le jour. */
const GlypheDate = (
  <Glyphe>
    <rect x="3.25" y="5" width="17.5" height="16" rx="2.25" />
    <path d="M3.25 10h17.5M8 3v4M16 3v4" />
  </Glyphe>
);

/** Une horloge : l'heure de début. */
const GlypheHeure = (
  <Glyphe>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.25V12l3.25 1.9" />
  </Glyphe>
);

/** Un repère de carte : l'endroit existe, il est à Yamoussoukro. */
const GlypheLieu = (
  <Glyphe>
    <path d="M12 21.5s6.75-5.9 6.75-11.1a6.75 6.75 0 1 0-13.5 0C5.25 15.6 12 21.5 12 21.5Z" />
    <circle cx="12" cy="10.1" r="2.4" />
  </Glyphe>
);

/**
 * Yamoussoukro est en UTC+0 toute l'année. Le fuseau est écrit en clair :
 * sans lui, le formatage suivrait celui du serveur qui fait le build, et
 * l'heure affichée dépendrait de la machine qui a déployé le site.
 */
const FUSEAU = "Africa/Abidjan";

const jour = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: FUSEAU,
});

const heure = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: FUSEAU,
});

/**
 * Sans édition, la card ne devine rien : les trois faits qui viennent de
 * l'API passent en [À DÉTERMINER] plutôt que de rejouer la dernière
 * valeur connue. Seul le lieu tient sans elle — il ne vient pas de l'API,
 * voir `FAITS_LOCAUX`.
 */

type Fait = {
  glyphe: ReactNode;
  etiquette: string;
  valeur: string;
  /** Vrai quand la valeur n'est pas arrêtée : elle s'affiche en accent. */
  aDeterminer: boolean;
};

export function CarteInfos({ edition }: { edition: Edition | null }) {
  const debut = edition ? new Date(edition.dateDebut) : null;

  const faits: Fait[] = [
    {
      glyphe: GlypheDate,
      etiquette: "Date",
      valeur: debut ? jour.format(debut) : A_DETERMINER,
      aDeterminer: debut === null,
    },
    {
      glyphe: GlypheHeure,
      etiquette: "Heure",
      valeur: debut ? `${heure.format(debut)} — début` : A_DETERMINER,
      aDeterminer: debut === null,
    },
    {
      glyphe: GlypheLieu,
      etiquette: "Lieu",
      valeur: edition?.lieu ?? FAITS_LOCAUX.lieu,
      aDeterminer: false,
    },
  ];

  return (
    <dl
      // `max-w` borne la card : sans lui elle prenait toute la colonne
      // du hero et pesait plus lourd que le titre. Les deux premières
      // colonnes se contentent de leur contenu, le lieu prend ce qui reste.
      className="grid w-full max-w-[clamp(20rem,52vw,38rem)] grid-cols-1
                 divide-y divide-accent/25 overflow-hidden rounded-card
                 border border-accent/60
                 sm:grid-cols-[auto_auto_minmax(0,1fr)]
                 sm:divide-x sm:divide-y-0"
      style={{ backgroundColor: FOND }}
    >
      {faits.map(({ glyphe, etiquette, valeur, aDeterminer }) => (
        <div
          key={etiquette}
          className="flex min-w-0 flex-col gap-[clamp(0.25rem,0.7svh,0.4375rem)]
                     px-[clamp(0.875rem,1.5vw,1.25rem)]
                     py-[clamp(0.5rem,1.3svh,0.8125rem)]"
        >
          {/* Le glyphe est nu : la pastille claire de la version bleue
              ajoutait de la hauteur à chaque bloc pour rien. */}
          <dt
            className="flex items-center gap-[0.75ch] font-mono
                       text-[length:clamp(0.625rem,0.68vw,0.75rem)]
                       uppercase tracking-[0.2em] text-fg/55"
          >
            <span className="text-cta">{glyphe}</span>
            {etiquette}
          </dt>

          {/* `text-pretty` pour que l'adresse ne laisse pas un mot seul
              sur la dernière ligne quand la colonne se resserre.
              `first-letter:uppercase` : « samedi 5 décembre » sort en
              minuscule d'Intl, c'est la règle française, mais en tête de
              valeur la capitale se lit mieux. */}
          <dd
            className={`text-pretty text-[length:clamp(0.875rem,0.95vw,1.0625rem)]
                        font-semibold leading-snug first-letter:uppercase ${
                          aDeterminer ? "text-accent" : "text-fg"
                        }`}
          >
            {valeur}
          </dd>
        </div>
      ))}
    </dl>
  );
}

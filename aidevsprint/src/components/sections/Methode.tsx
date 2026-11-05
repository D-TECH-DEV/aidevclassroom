import { EtiquetteSection } from "@/components/ui/EtiquetteSection";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Section — la méthode.
 *
 * Transcription du design `Landing — ai-dev-sprint.com@2x.png`.
 * Quatre cartes de même poids : aucune n'est plus importante que l'autre,
 * c'est une méthode en quatre pièces, pas une progression. D'où la grille
 * régulière, et non le bento asymétrique des autres sections.
 *
 * Le glyphe de chaque carte est du code, pas une icône : `.md`, `{ }`,
 * `>_`, `</>`. Rien à charger, et ça parle à qui lit la page.
 */

const PIECES = [
  {
    glyphe: ".md",
    titre: "Le contexte",
    texte:
      "Des fichiers qui décrivent ta stack, tes conventions et tes règles. L'IA code comme toi, pas au hasard.",
  },
  {
    glyphe: "{ }",
    titre: "Les skills",
    texte:
      "Des savoir-faire réutilisables que tu donnes à l'IA : design, API, déploiement. Même qualité à chaque fois.",
  },
  {
    glyphe: ">_",
    titre: "Les bons prompts",
    texte:
      "Découper, préciser, itérer. Tu guides l'IA étape par étape au lieu de tout lui demander d'un coup.",
  },
  {
    glyphe: "</>",
    titre: "Revue & sécurité",
    texte:
      "Tu relis ce que l'IA produit, tu repères les failles et tu corriges avant de mettre en ligne.",
  },
];

export function Methode() {
  return (
    <section
      id="methode"
      className="relative bg-surface py-[clamp(4rem,12svh,9rem)]"
    >
      <Reveal className="shell">
        <EtiquetteSection>la méthode</EtiquetteSection>

        <h2 className="mt-[clamp(1rem,3svh,2rem)] max-w-[18ch] text-h1 font-bold leading-[1.05] tracking-tighter">
          Toi aux commandes. L&apos;IA au clavier.
        </h2>

        <p className="mt-[clamp(1rem,2.5svh,1.75rem)] max-w-[60ch] text-body text-fg/70">
          On te montre exactement comment on travaille sur nos propres projets
          clients.
        </p>

        {/* Deux colonnes dès la tablette, quatre à partir de xl : à quatre
            de front sous 1280px, chaque carte tombe sous 15ch et le texte
            se casse mot par mot. */}
        <ul className="mt-[clamp(2.5rem,8svh,5rem)] grid gap-[clamp(1rem,1.5vw,1.25rem)] sm:grid-cols-2 xl:grid-cols-4">
          {PIECES.map(({ glyphe, titre, texte }) => (
            <li
              key={titre}
              className="flex flex-col rounded-card border border-fg/10
                         p-[clamp(1.5rem,2.5vw,2rem)] transition-colors
                         duration-[200ms] ease-[var(--ease-out-strong)]
                         hoverable:hover:border-accent/50"
            >
              <p
                aria-hidden
                className="font-mono text-h3 font-bold leading-none text-accent"
              >
                {glyphe}
              </p>

              <h3 className="mt-[clamp(1rem,2.5svh,1.75rem)] text-h3 font-bold tracking-tight">
                {titre}
              </h3>

              <p className="mt-[clamp(0.75rem,1.5svh,1rem)] text-body text-fg/70">
                {texte}
              </p>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

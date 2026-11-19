import { EtiquetteSection } from "@/components/ui/EtiquetteSection";
import { Reveal } from "@/components/motion/Reveal";
import type { QuestionFaq } from "@/lib/contenu";

/**
 * Section — questions fréquentes.
 *
 * Les réponses sont toutes visibles, pas repliées dans un accordéon,
 * et alimentées depuis le panneau `/admin/contenu`.
 */

const A_COMPLETER = "[À COMPLÉTER]";

export function Faq({ questions }: { questions: QuestionFaq[] }) {
  return (
    <section id="faq" className="relative py-[clamp(4rem,12svh,9rem)]">
      <Reveal className="shell">
        {/* La FAQ se lit en colonne étroite : une réponse qui court sur
            120 caractères oblige l'œil à revenir trop loin à chaque ligne.
            Le bloc est décalé comme dans le design, pas centré. */}
        <div className="max-w-[72ch] lg:ml-[8.333%]">
          <EtiquetteSection>faq</EtiquetteSection>

          <h2 className="mt-[clamp(1rem,3svh,2rem)] text-h1 font-bold leading-[1.05] tracking-tighter">
            Questions fréquentes
          </h2>

          <dl className="mt-[clamp(2rem,6svh,3.5rem)] border-t border-fg/15">
            {questions.map(({ id, question, answer }, i) => (
              <div
                key={id ?? `${question}-${i}`}
                className="border-b border-fg/15 py-[clamp(1.5rem,4svh,2.5rem)]"
              >
                <dt className="text-h3 font-bold tracking-tight">{question}</dt>
                <dd
                  className={`mt-[clamp(0.625rem,1.5svh,1rem)] text-body ${
                    answer ? "text-fg/70" : "font-mono text-accent/70"
                  }`}
                >
                  {answer ?? `${A_COMPLETER} — la réponse n'est pas arrêtée.`}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>
    </section>
  );
}

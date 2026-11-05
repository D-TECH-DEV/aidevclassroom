import { EtiquetteSection } from "@/components/ui/EtiquetteSection";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Section — questions fréquentes.
 *
 * Transcription du design `Landing — ai-dev-sprint.com@2x.png`.
 * Les réponses sont toutes visibles, pas repliées dans un accordéon :
 * elles tiennent en une ligne chacune, et un accordéon ferait cliquer
 * quatre fois pour lire quatre phrases. Un filet sépare les entrées.
 *
 * La réponse sur l'ordinateur portait `[RÉPONSE À CONFIRMER]` dans le
 * design : elle reste marquée, pas inventée.
 */

const A_COMPLETER = "[À COMPLÉTER]";

const QUESTIONS: { question: string; reponse: string | null }[] = [
  {
    question: "Quel niveau faut-il avoir ?",
    reponse:
      "Des bases en développement. L'IA ne remplace pas les compétences, elle les démultiplie.",
  },
  {
    question: "Avec quoi je repars ?",
    reponse:
      "Ton portfolio en ligne, avec son espace admin et son chatbot IA, plus la méthode pour tes prochains projets.",
  },
  {
    question: "Dois-je venir avec mon ordinateur ?",
    reponse: null,
  },
  {
    question: "Comment réserver ?",
    reponse: "Directement sur ce site, ou sur WhatsApp au 07 04 92 10 80.",
  },
];

export function Faq() {
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
            {QUESTIONS.map(({ question, reponse }) => (
              <div
                key={question}
                className="border-b border-fg/15 py-[clamp(1.5rem,4svh,2.5rem)]"
              >
                <dt className="text-h3 font-bold tracking-tight">{question}</dt>
                <dd
                  className={`mt-[clamp(0.625rem,1.5svh,1rem)] text-body ${
                    reponse ? "text-fg/70" : "font-mono text-accent/70"
                  }`}
                >
                  {reponse ?? `${A_COMPLETER} — la réponse n'est pas arrêtée.`}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>
    </section>
  );
}

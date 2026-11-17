"use client";

import type { Dispatch, SetStateAction } from "react";
import type { QuestionFaqAdmin } from "@/lib/admin/types";

const champ =
  "w-full rounded-field border border-fg/20 bg-bg px-4 py-3 " +
  "text-fg placeholder:text-fg/35 outline-none focus-visible:border-accent/60";
const etiquette = "font-mono text-small uppercase tracking-[0.15em] text-fg/55";
const boutonSecondaire =
  "rounded-field border border-fg/20 px-3 py-1.5 font-mono text-small " +
  "text-fg/75 transition-colors hover:border-accent/60 hover:text-fg disabled:opacity-35";

function deplace<T>(liste: T[], index: number, delta: -1 | 1): T[] {
  const cible = index + delta;
  if (cible < 0 || cible >= liste.length) return liste;
  const copie = [...liste];
  const [element] = copie.splice(index, 1);
  copie.splice(cible, 0, element);
  return copie;
}

export function SectionFaqAdmin({
  faqs,
  setFaqs,
}: {
  faqs: QuestionFaqAdmin[];
  setFaqs: Dispatch<SetStateAction<QuestionFaqAdmin[]>>;
}) {
  function maj(index: number, patch: Partial<QuestionFaqAdmin>) {
    setFaqs((c) =>
      c.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-card border border-fg/15 bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-small font-bold uppercase tracking-[0.18em] text-accent">
          Questions fréquentes ({faqs.length})
        </h2>
        <button
          type="button"
          disabled={faqs.length >= 25}
          onClick={() => setFaqs((c) => [...c, { question: "", answer: "" }])}
          className={boutonSecondaire}
        >
          + Ajouter une question
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {faqs.map((f, idx) => (
          <div
            key={f.id ?? `nouvelle-faq-${idx}`}
            className="flex flex-col gap-4 rounded-field border border-fg/15 bg-bg/50 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-small font-bold text-fg/80">
                Question #{idx + 1}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => setFaqs((c) => deplace(c, idx, -1))}
                  className={boutonSecondaire}
                >
                  Monter
                </button>
                <button
                  type="button"
                  disabled={idx === faqs.length - 1}
                  onClick={() => setFaqs((c) => deplace(c, idx, 1))}
                  className={boutonSecondaire}
                >
                  Descendre
                </button>
                <button
                  type="button"
                  onClick={() => setFaqs((c) => c.filter((_, i) => i !== idx))}
                  className={boutonSecondaire}
                >
                  Supprimer
                </button>
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className={etiquette}>Question</span>
              <input
                type="text"
                required
                maxLength={255}
                value={f.question}
                onChange={(e) => maj(idx, { question: e.target.value })}
                className={champ}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className={etiquette}>Réponse</span>
              <textarea
                rows={2}
                maxLength={2500}
                value={f.answer ?? ""}
                onChange={(e) => maj(idx, { answer: e.target.value || null })}
                className={`${champ} resize-y`}
              />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

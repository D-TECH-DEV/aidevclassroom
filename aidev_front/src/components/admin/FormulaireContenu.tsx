"use client";

import { useActionState, useState } from "react";
import {
  enregistrerContenuSite,
  type EtatContenu,
} from "@/app/admin/actions";
import type {
  ContenuSiteAdmin,
  FormateurAdmin,
  QuestionFaqAdmin,
} from "@/lib/admin/types";
import { Alerte } from "./Briques";

const INITIAL: EtatContenu = {};

const champ =
  "w-full rounded-field border border-fg/20 bg-bg px-4 py-3 " +
  "text-fg placeholder:text-fg/35 outline-none " +
  "focus-visible:border-accent/60";

const etiquette =
  "font-mono text-small uppercase tracking-[0.15em] text-fg/55";

const boutonSecondaire =
  "rounded-field border border-fg/20 px-3 py-1.5 font-mono text-small " +
  "text-fg/75 transition-colors hover:border-accent/60 hover:text-fg " +
  "disabled:opacity-35";

function deplaceDansListe<T>(liste: T[], index: number, delta: -1 | 1): T[] {
  const cible = index + delta;
  if (cible < 0 || cible >= liste.length) return liste;
  const copie = [...liste];
  const [element] = copie.splice(index, 1);
  copie.splice(cible, 0, element);
  return copie;
}

export function FormulaireContenu({ initial }: { initial: ContenuSiteAdmin }) {
  const [etat, agir, enCours] = useActionState(enregistrerContenuSite, INITIAL);
  const [whatsappDisplay, setWhatsappDisplay] = useState(
    initial.whatsappDisplay,
  );
  const [whatsappHref, setWhatsappHref] = useState(initial.whatsappHref);
  const [trainers, setTrainers] = useState<FormateurAdmin[]>(initial.trainers);
  const [faqs, setFaqs] = useState<QuestionFaqAdmin[]>(initial.faqs);

  const payload = JSON.stringify({
    whatsappDisplay,
    whatsappHref,
    trainers,
    faqs,
  });

  function metAJourFormateur(
    index: number,
    patch: Partial<FormateurAdmin>,
  ) {
    setTrainers((courant) =>
      courant.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function metAJourFaq(index: number, patch: Partial<QuestionFaqAdmin>) {
    setFaqs((courant) =>
      courant.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <form action={agir} className="flex flex-col gap-8">
      <input type="hidden" name="payload" value={payload} />

      <section className="flex flex-col gap-5 rounded-card border border-fg/15 bg-surface p-6">
        <h2 className="font-mono text-small font-bold uppercase tracking-[0.18em] text-accent">
          Contact WhatsApp
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={etiquette}>Numéro affiché</span>
            <input
              type="text"
              required
              maxLength={30}
              value={whatsappDisplay}
              onChange={(e) => setWhatsappDisplay(e.target.value)}
              placeholder="07 04 92 10 80"
              className={`${champ} font-mono`}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={etiquette}>Lien WhatsApp (HTTPS)</span>
            <input
              type="url"
              required
              maxLength={255}
              value={whatsappHref}
              onChange={(e) => setWhatsappHref(e.target.value)}
              placeholder="https://wa.me/2250704921080"
              className={`${champ} font-mono`}
            />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-card border border-fg/15 bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-small font-bold uppercase tracking-[0.18em] text-accent">
            Formateurs ({trainers.length})
          </h2>
          <button
            type="button"
            disabled={trainers.length >= 12}
            onClick={() =>
              setTrainers((courant) => [
                ...courant,
                {
                  firstName: "",
                  lastName: null,
                  role: "",
                  photoPath: null,
                  badgePath: null,
                  bio: null,
                  githubUrl: null,
                  linkedinUrl: null,
                  portfolioUrl: null,
                },
              ])
            }
            className={boutonSecondaire}
          >
            + Ajouter un formateur
          </button>
        </div>

        <div className="flex flex-col gap-5">
          {trainers.map((t, idx) => (
            <div
              key={t.id ?? `nouveau-formateur-${idx}`}
              className="flex flex-col gap-4 rounded-field border border-fg/15 bg-bg/50 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-small font-bold text-fg/80">
                  Intervenant #{idx + 1}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() =>
                      setTrainers((c) => deplaceDansListe(c, idx, -1))
                    }
                    className={boutonSecondaire}
                  >
                    Monter
                  </button>
                  <button
                    type="button"
                    disabled={idx === trainers.length - 1}
                    onClick={() =>
                      setTrainers((c) => deplaceDansListe(c, idx, 1))
                    }
                    className={boutonSecondaire}
                  >
                    Descendre
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTrainers((c) => c.filter((_, i) => i !== idx))
                    }
                    className={boutonSecondaire}
                  >
                    Supprimer
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <span className={etiquette}>Prénom</span>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={t.firstName}
                    onChange={(e) =>
                      metAJourFormateur(idx, { firstName: e.target.value })
                    }
                    className={champ}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className={etiquette}>Nom (optionnel)</span>
                  <input
                    type="text"
                    maxLength={120}
                    value={t.lastName ?? ""}
                    onChange={(e) =>
                      metAJourFormateur(idx, {
                        lastName: e.target.value || null,
                      })
                    }
                    className={champ}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className={etiquette}>Rôle</span>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={t.role}
                    onChange={(e) =>
                      metAJourFormateur(idx, { role: e.target.value })
                    }
                    className={champ}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className={etiquette}>Ce qu&apos;il transmet</span>
                <textarea
                  rows={2}
                  maxLength={1500}
                  value={t.bio ?? ""}
                  onChange={(e) =>
                    metAJourFormateur(idx, { bio: e.target.value || null })
                  }
                  className={`${champ} resize-y`}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className={etiquette}>Photo (/formateurs/...)</span>
                  <input
                    type="text"
                    maxLength={255}
                    value={t.photoPath ?? ""}
                    onChange={(e) =>
                      metAJourFormateur(idx, {
                        photoPath: e.target.value || null,
                      })
                    }
                    placeholder="/formateurs/victorien.png"
                    className={`${champ} font-mono`}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className={etiquette}>Badge 3D (/badges/...)</span>
                  <input
                    type="text"
                    maxLength={255}
                    value={t.badgePath ?? ""}
                    onChange={(e) =>
                      metAJourFormateur(idx, {
                        badgePath: e.target.value || null,
                      })
                    }
                    placeholder="/badges/victorien.png"
                    className={`${champ} font-mono`}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <span className={etiquette}>GitHub (HTTPS)</span>
                  <input
                    type="url"
                    maxLength={255}
                    value={t.githubUrl ?? ""}
                    onChange={(e) =>
                      metAJourFormateur(idx, {
                        githubUrl: e.target.value || null,
                      })
                    }
                    placeholder="https://github.com/..."
                    className={`${champ} font-mono`}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className={etiquette}>LinkedIn (HTTPS)</span>
                  <input
                    type="url"
                    maxLength={255}
                    value={t.linkedinUrl ?? ""}
                    onChange={(e) =>
                      metAJourFormateur(idx, {
                        linkedinUrl: e.target.value || null,
                      })
                    }
                    placeholder="https://www.linkedin.com/in/..."
                    className={`${champ} font-mono`}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className={etiquette}>Portfolio (HTTPS)</span>
                  <input
                    type="url"
                    maxLength={255}
                    value={t.portfolioUrl ?? ""}
                    onChange={(e) =>
                      metAJourFormateur(idx, {
                        portfolioUrl: e.target.value || null,
                      })
                    }
                    placeholder="https://..."
                    className={`${champ} font-mono`}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-card border border-fg/15 bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-small font-bold uppercase tracking-[0.18em] text-accent">
            Questions fréquentes ({faqs.length})
          </h2>
          <button
            type="button"
            disabled={faqs.length >= 25}
            onClick={() =>
              setFaqs((courant) => [
                ...courant,
                { question: "", answer: "" },
              ])
            }
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
                    onClick={() =>
                      setFaqs((c) => deplaceDansListe(c, idx, -1))
                    }
                    className={boutonSecondaire}
                  >
                    Monter
                  </button>
                  <button
                    type="button"
                    disabled={idx === faqs.length - 1}
                    onClick={() => setFaqs((c) => deplaceDansListe(c, idx, 1))}
                    className={boutonSecondaire}
                  >
                    Descendre
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFaqs((c) => c.filter((_, i) => i !== idx))
                    }
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
                  onChange={(e) =>
                    metAJourFaq(idx, { question: e.target.value })
                  }
                  className={champ}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className={etiquette}>Réponse</span>
                <textarea
                  rows={2}
                  maxLength={2500}
                  value={f.answer ?? ""}
                  onChange={(e) =>
                    metAJourFaq(idx, { answer: e.target.value || null })
                  }
                  className={`${champ} resize-y`}
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}

      {etat.succes ? (
        <div
          role="status"
          className="rounded-field border border-accent/40 bg-accent/10 px-4 py-3 text-body text-fg"
        >
          {etat.succes}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={enCours}
        className="w-fit rounded-field bg-cta px-6 py-3 font-bold text-fg
                   outline-none focus-visible:border focus-visible:border-fg
                   disabled:opacity-60"
      >
        {enCours ? "Enregistrement…" : "Enregistrer le contenu"}
      </button>
    </form>
  );
}

"use client";

import { startTransition, useActionState, useState } from "react";
import {
  enregistrerContenuSite,
  type EtatContenu,
} from "@/app/admin/actions";
import type {
  ContenuSiteAdmin,
  FormateurAdmin,
  QuestionFaqAdmin,
} from "@/lib/admin/types";
import { Alerte, EnTetePage } from "./Briques";
import { SectionFormateursAdmin } from "./SectionFormateursAdmin";
import { SectionFaqAdmin } from "./SectionFaqAdmin";

const INITIAL: EtatContenu = {};

const champ =
  "w-full rounded-field border border-fg/20 bg-bg px-4 py-3 " +
  "text-fg placeholder:text-fg/35 outline-none focus-visible:border-accent/60";
const etiquette = "font-mono text-small uppercase tracking-[0.15em] text-fg/55";

type OngletContenu = "contact" | "formateurs" | "faq";

export function FormulaireContenu({ initial }: { initial: ContenuSiteAdmin }) {
  const [etat, agir, enCours] = useActionState(enregistrerContenuSite, INITIAL);
  const [onglet, setOnglet] = useState<OngletContenu>("contact");

  const [whatsappDisplay, setWhatsappDisplay] = useState(
    initial.whatsappDisplay,
  );
  const [whatsappHref, setWhatsappHref] = useState(initial.whatsappHref);
  const [contactEmail, setContactEmail] = useState(initial.contactEmail ?? "");
  const [trainers, setTrainers] = useState<FormateurAdmin[]>(initial.trainers);
  const [faqs, setFaqs] = useState<QuestionFaqAdmin[]>(initial.faqs);

  const payload = JSON.stringify({
    whatsappDisplay,
    whatsappHref,
    contactEmail: contactEmail.trim() || null,
    trainers,
    faqs,
  });

  function sauvegarderAvecFormateurs(suivants: FormateurAdmin[]) {
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        whatsappDisplay,
        whatsappHref,
        contactEmail: contactEmail.trim() || null,
        trainers: suivants,
        faqs,
      }),
    );
    startTransition(() => {
      agir(fd);
    });
  }

  const onglets: Array<{ id: OngletContenu; label: string }> = [
    { id: "contact", label: "Contact" },
    { id: "formateurs", label: `Formateurs (${trainers.length})` },
    { id: "faq", label: `Questions fréquentes (${faqs.length})` },
  ];

  return (
    <form action={agir} className="flex flex-col gap-6">
      <input type="hidden" name="payload" value={payload} />

      <EnTetePage
        surtitre="Éditorial"
        titre="Contenu vitrine"
        description="Contact, profils des formateurs et questions fréquentes."
        action={
          <button
            type="submit"
            disabled={enCours}
            className="w-fit rounded-field bg-cta px-6 py-2.5 font-bold text-fg
                       outline-none focus-visible:border focus-visible:border-fg
                       disabled:opacity-60"
          >
            {enCours ? "Enregistrement…" : "Enregistrer le contenu"}
          </button>
        }
      />

      {etat.succes ? (
        <div
          role="status"
          className="rounded-field border border-accent/40 bg-accent/10 px-4 py-2.5 text-small text-fg"
        >
          {etat.succes}
        </div>
      ) : null}

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}

      <div
        role="tablist"
        aria-label="Sections du contenu vitrine"
        className="inline-flex w-fit flex-wrap items-center gap-1 rounded-field
                   border border-fg/15 bg-bg/60 p-1"
      >
        {onglets.map((item) => {
          const actif = onglet === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => setOnglet(item.id)}
              className={`rounded-field border px-4 py-2 font-mono text-small
                          transition-colors ${
                            actif
                              ? "border-accent/40 bg-accent/15 font-semibold text-accent"
                              : "border-transparent text-fg/60 hover:text-fg"
                          }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {onglet === "contact" ? (
        <section className="flex flex-col gap-5 rounded-card border border-fg/15 bg-surface p-6">
          <h2 className="font-mono text-small font-bold uppercase tracking-[0.18em] text-accent">
            Contact &amp; Support vitrine
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className={etiquette}>Numéro WhatsApp affiché</span>
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

          <label className="flex flex-col gap-2 md:max-w-md">
            <span className={etiquette}>E-mail de contact (affiché en pied de page)</span>
            <input
              type="email"
              maxLength={180}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@aidevclassroom.com"
              className={`${champ} font-mono`}
            />
          </label>
        </section>
      ) : null}

      {onglet === "formateurs" ? (
        <SectionFormateursAdmin
          trainers={trainers}
          setTrainers={setTrainers}
          onSauvegarder={sauvegarderAvecFormateurs}
        />
      ) : null}

      {onglet === "faq" ? (
        <SectionFaqAdmin faqs={faqs} setFaqs={setFaqs} />
      ) : null}
    </form>
  );
}

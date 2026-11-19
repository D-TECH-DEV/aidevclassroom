"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { LIBELLE_SPRINT, type Sprint } from "@/lib/admin/types";
import { CHAMP_CLS, ETIQUETTE_CLS } from "./ModaleSprintEtapes";

const ETAPES = [
  { numero: 1, titre: "Identité & Calendrier" },
  { numero: 2, titre: "Tarifs Solo & Duo" },
  { numero: 3, titre: "Programme & Publication" },
] as const;

export function BarreEtapesModale({
  etape,
  allerVersEtape,
}: {
  etape: 1 | 2 | 3;
  allerVersEtape: (cible: 1 | 2 | 3) => void;
}) {
  return (
    <div className="border-b border-fg/10 bg-bg/40 px-6 py-3">
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {ETAPES.map((item) => {
          const courant = etape === item.numero;
          const termine = etape > item.numero;
          return (
            <li key={item.numero}>
              <button
                type="button"
                onClick={() => allerVersEtape(item.numero)}
                className={`flex w-full items-center gap-2.5 rounded-field border px-3 py-2 text-left font-mono text-small transition-colors ${
                  courant
                    ? "border-accent/60 bg-accent/15 text-fg font-semibold"
                    : termine
                      ? "border-accent/30 bg-surface text-fg/80"
                      : "border-fg/10 bg-transparent text-fg/45"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.75rem] ${
                    courant || termine ? "bg-accent text-bg font-bold" : "border border-fg/25 text-fg/55"
                  }`}
                >
                  {termine ? <HugeiconsIcon icon={Tick02Icon} size={12} /> : item.numero}
                </span>
                <span className="truncate">{item.titre}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function EtapeProgramme({
  edition,
  sprint,
  ville,
  setVille,
  format,
  setFormat,
  lieu,
  setLieu,
  niveau,
  setNiveau,
  modules,
  setModules,
  lancer,
  setLancer,
  notifier,
  setNotifier,
  noteNotification,
  setNoteNotification,
}: {
  edition: boolean;
  sprint?: Sprint | null;
  ville: string;
  setVille: (v: string) => void;
  format: string;
  setFormat: (v: string) => void;
  lieu: string;
  setLieu: (v: string) => void;
  niveau: string;
  setNiveau: (v: string) => void;
  modules: string;
  setModules: (v: string) => void;
  lancer: boolean;
  setLancer: (v: boolean) => void;
  notifier: boolean;
  setNotifier: (v: boolean) => void;
  noteNotification: string;
  setNoteNotification: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETTE_CLS}>Ville</span>
          <input
            type="text"
            maxLength={100}
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            placeholder="Yamoussoukro"
            className={CHAMP_CLS}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETTE_CLS}>Format</span>
          <input
            type="text"
            maxLength={120}
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            placeholder="1 journée · présentiel"
            className={CHAMP_CLS}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETTE_CLS}>Lieu / Salle</span>
          <input
            type="text"
            maxLength={255}
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            placeholder="Mairie de Yamoussoukro — salle multimédia Orange"
            className={CHAMP_CLS}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETTE_CLS}>Niveau prérequis</span>
          <input
            type="text"
            maxLength={120}
            value={niveau}
            onChange={(e) => setNiveau(e.target.value)}
            placeholder="Bases en dev"
            className={CHAMP_CLS}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={ETIQUETTE_CLS}>
          Étapes du programme (une par ligne, 8 maximum)
        </span>
        <textarea
          rows={4}
          value={modules}
          onChange={(e) => setModules(e.target.value)}
          placeholder={
            "Le design de ton site\nLe code, en guidant l'IA\nTon admin + ton chatbot IA\nTon site déployé en ligne"
          }
          className={`${CHAMP_CLS} resize-y`}
        />
      </label>

      {!edition ? (
        <label className="flex items-center gap-3 rounded-field border border-fg/15 bg-bg/60 px-4 py-3">
          <input
            type="checkbox"
            checked={lancer}
            onChange={(e) => setLancer(e.target.checked)}
            className="size-4 accent-[#2ee66b]"
          />
          <span className="flex flex-col">
            <span className={ETIQUETTE_CLS}>
              Lancer immédiatement sur le site public
            </span>
            <span className="font-mono text-small text-fg/45">
              Coché = statut « Lancé », décoché = « Brouillon ».
            </span>
          </span>
        </label>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-field border border-fg/15 bg-bg/50 px-4 py-3 font-mono text-small text-fg/65">
            Statut actuel :{" "}
            <span className="font-bold text-accent">
              {sprint ? LIBELLE_SPRINT[sprint.status] : "—"}
            </span>{" "}
            (modifiable directement depuis les boutons de la liste).
          </div>

          {sprint?.status === "ACTIVE" ? (
            <div className="flex flex-col gap-2.5 rounded-field border border-accent/30 bg-bg/60 px-4 py-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={notifier}
                  onChange={(e) => setNotifier(e.target.checked)}
                  className="mt-0.5 size-4 accent-[#2ee66b]"
                />
                <span className="flex flex-col">
                  <span className={ETIQUETTE_CLS}>
                    Notifier par e-mail les inscrits (avec acompte payé)
                  </span>
                  <span className="font-mono text-small text-fg/50">
                    Un e-mail est envoyé uniquement si la date, la ville ou le lieu a changé.
                  </span>
                </span>
              </label>

              {notifier ? (
                <label className="flex flex-col gap-1">
                  <span className={ETIQUETTE_CLS}>
                    Note complémentaire dans l&apos;e-mail (optionnel)
                  </span>
                  <input
                    type="text"
                    maxLength={500}
                    value={noteNotification}
                    onChange={(e) => setNoteNotification(e.target.value)}
                    placeholder="Ex. Changement de salle pour mieux vous accueillir."
                    className={CHAMP_CLS}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function versSaisieDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function valideEtape1Sprint(opts: {
  edition: boolean;
  nom: string;
  slug: string;
  debut: string;
  fin: string;
  capacite: string;
}): string | null {
  if (!opts.nom.trim()) return "Le nom du sprint est requis.";
  if (!opts.edition && !/^[a-z0-9-]+$/.test(opts.slug.trim().toLowerCase())) {
    return "Slug invalide : lettres minuscules, chiffres et tirets uniquement.";
  }
  if (!opts.debut || !opts.fin) {
    return "Les dates de début et de fin sont requises.";
  }
  if (new Date(opts.debut) >= new Date(opts.fin)) {
    return "La date de fin doit être postérieure à la date de début.";
  }
  if (opts.capacite.trim()) {
    const cap = Number(opts.capacite.trim());
    if (!Number.isInteger(cap) || cap < 1) {
      return "La capacité doit être un entier positif.";
    }
  }
  return null;
}

export function valideEtape2Sprint(opts: {
  prix: string;
  minimum: string;
  prixDuo: string;
  minimumDuo: string;
}): string | null {
  const p = Number(opts.prix.trim());
  const m = Number(opts.minimum.trim());
  if (!Number.isInteger(p) || p <= 0) {
    return "Le prix Solo doit être un entier positif en FCFA.";
  }
  if (!Number.isInteger(m) || m < 1 || m > p) {
    return "Versement minimum Solo invalide.";
  }
  const pdTrim = opts.prixDuo.trim();
  const mdTrim = opts.minimumDuo.trim();
  if (mdTrim && !pdTrim) return "Le minimum Duo exige un prix Duo.";
  if (pdTrim) {
    const pd = Number(pdTrim);
    if (!Number.isInteger(pd) || pd <= 0) {
      return "Le prix Duo doit être un entier positif en FCFA.";
    }
    if (mdTrim) {
      const md = Number(mdTrim);
      if (!Number.isInteger(md) || md < 1 || md > pd) {
        return "Versement minimum Duo invalide.";
      }
    }
  }
  return null;
}

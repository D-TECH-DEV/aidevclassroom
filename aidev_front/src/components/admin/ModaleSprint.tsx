"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import {
  creerNouveauSprint,
  modifierSprintExistant,
  type Etat,
} from "@/app/admin/actions";
import type { Sprint } from "@/lib/admin/types";
import { Alerte } from "./Briques";
import { EtapeIdentite, EtapeTarifs } from "./ModaleSprintEtapes";
import { emettreToastNotificationMail } from "./ToastNotificationMail";
import {
  BarreEtapesModale,
  EtapeProgramme,
  valideEtape1Sprint,
  valideEtape2Sprint,
  versSaisieDate,
} from "./ModaleSprintEtapeProgramme";

const INITIAL: Etat = {};

export function ModaleSprint({
  ouvert,
  sprint,
  onFermer,
}: {
  ouvert: boolean;
  sprint?: Sprint | null;
  onFermer: () => void;
}) {
  const edition = Boolean(sprint);
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [etatCreation, agirCreation, enCoursCreation] = useActionState(
    creerNouveauSprint,
    INITIAL,
  );
  const [etatEdition, agirEdition, enCoursEdition] = useActionState(
    modifierSprintExistant,
    INITIAL,
  );

  const etat = edition ? etatEdition : etatCreation;
  const agir = edition ? agirEdition : agirCreation;
  const enCours = edition ? enCoursEdition : enCoursCreation;

  const [etape, setEtape] = useState<1 | 2 | 3>(1);
  const [erreurEtape, setErreurEtape] = useState<string | null>(null);
  const [slugTouche, setSlugTouche] = useState(false);

  const [nom, setNom] = useState(sprint?.name ?? "");
  const [slug, setSlug] = useState(sprint?.slug ?? "");
  const [description, setDescription] = useState(sprint?.description ?? "");
  const [debut, setDebut] = useState(versSaisieDate(sprint?.startAt));
  const [fin, setFin] = useState(versSaisieDate(sprint?.endAt));
  const [capacite, setCapacite] = useState(
    sprint?.capacity != null ? String(sprint.capacity) : "",
  );
  const [prix, setPrix] = useState(
    sprint?.priceXof != null ? String(sprint.priceXof) : "",
  );
  const [minimum, setMinimum] = useState(
    sprint?.minimumPaymentXof != null ? String(sprint.minimumPaymentXof) : "",
  );
  const [prixDuo, setPrixDuo] = useState(
    sprint?.duoPriceXof != null ? String(sprint.duoPriceXof) : "",
  );
  const [minimumDuo, setMinimumDuo] = useState(
    sprint?.duoMinimumPaymentXof != null
      ? String(sprint.duoMinimumPaymentXof)
      : "",
  );
  const [retirerDuo, setRetirerDuo] = useState(false);
  const [ville, setVille] = useState(sprint?.city ?? "");
  const [format, setFormat] = useState(sprint?.format ?? "");
  const [lieu, setLieu] = useState(sprint?.location ?? "");
  const [niveau, setNiveau] = useState(sprint?.level ?? "");
  const [modules, setModules] = useState((sprint?.modules ?? []).join("\n"));
  const [lancer, setLancer] = useState(false);
  const [notifier, setNotifier] = useState(true);
  const [noteNotification, setNoteNotification] = useState("");

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (ouvert && !dlg.open) dlg.showModal();
    else if (!ouvert && dlg.open) dlg.close();
  }, [ouvert]);

  useEffect(() => {
    if (etat.succes && ouvert) {
      emettreToastNotificationMail(etat.notification);
      dialogRef.current?.close();
      onFermer();
      router.refresh();
    }
  }, [etat.succes, etat.notification, ouvert, onFermer, router]);

  function check1() {
    const err = valideEtape1Sprint({ edition, nom, slug, debut, fin, capacite });
    setErreurEtape(err);
    return err === null;
  }

  function check2() {
    const err = valideEtape2Sprint({ prix, minimum, prixDuo, minimumDuo });
    setErreurEtape(err);
    return err === null;
  }

  function allerVersEtape(cible: 1 | 2 | 3) {
    if (cible < etape) {
      setErreurEtape(null);
      setEtape(cible);
      return;
    }
    if (cible === 2 && etape === 1 && check1()) setEtape(2);
    else if (cible === 3) {
      if (etape === 1 && check1() && check2()) setEtape(3);
      else if (etape === 2 && check2()) setEtape(3);
    }
  }

  const pNum = Number(prix);
  const mNum = Number(minimum);
  const ratioAcompte =
    Number.isFinite(pNum) && pNum > 0 && Number.isFinite(mNum) && mNum > 0
      ? Math.round((mNum / pNum) * 100)
      : null;

  if (!ouvert) return null;

  const champsCaches: Array<[string, string]> = [
    ["mode", "modale"],
    ["nom", nom],
    ["slug", slug],
    ["description", description],
    ["debut", debut],
    ["fin", fin],
    ["capacite", capacite],
    ["prix", prix],
    ["minimum", minimum],
    ["prixDuo", prixDuo],
    ["minimumDuo", minimumDuo],
    ["retirerDuo", retirerDuo ? "oui" : "non"],
    ["ville", ville],
    ["format", format],
    ["lieu", lieu],
    ["niveau", niveau],
    ["modules", modules],
    ["notifier", notifier ? "oui" : "non"],
    ["noteNotification", noteNotification],
  ];

  return (
    <dialog
      ref={dialogRef}
      data-lenis-prevent
      onCancel={(e) => {
        e.preventDefault();
        if (!enCours) onFermer();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && !enCours) onFermer();
      }}
      className="m-auto w-[min(95vw,46rem)] rounded-card border border-fg/20
                 bg-surface p-0 text-fg backdrop:bg-bg/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[88svh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-fg/10 px-6 py-4">
          <div>
            <p className="font-mono text-small uppercase tracking-[0.2em] text-accent">
              {edition ? "Modification" : "Nouvelle session"}
            </p>
            <h2 className="mt-1 text-h3 font-bold tracking-tight text-fg">
              {edition ? `Modifier — ${sprint?.name}` : "Créer un sprint"}
            </h2>
          </div>
          <button
            type="button"
            disabled={enCours}
            onClick={onFermer}
            aria-label="Fermer la modale"
            className="rounded-field border border-fg/15 p-1.5 text-fg/60 transition-colors hover:border-fg/35 hover:text-fg disabled:opacity-40"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} />
          </button>
        </div>

        <BarreEtapesModale etape={etape} allerVersEtape={allerVersEtape} />

        <form action={agir} className="flex flex-1 flex-col overflow-hidden">
          {edition && sprint ? <input type="hidden" name="id" value={sprint.id} /> : null}
          {!edition && lancer ? <input type="hidden" name="lancer" value="oui" /> : null}
          {champsCaches.map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {etape === 1 ? (
              <EtapeIdentite
                edition={edition}
                nom={nom} setNom={setNom}
                slug={slug} setSlug={setSlug}
                slugTouche={slugTouche} setSlugTouche={setSlugTouche}
                description={description} setDescription={setDescription}
                debut={debut} setDebut={setDebut}
                fin={fin} setFin={setFin}
                capacite={capacite} setCapacite={setCapacite}
              />
            ) : null}
            {etape === 2 ? (
              <EtapeTarifs
                edition={edition} sprint={sprint}
                prix={prix} setPrix={setPrix}
                minimum={minimum} setMinimum={setMinimum}
                prixDuo={prixDuo} setPrixDuo={setPrixDuo}
                minimumDuo={minimumDuo} setMinimumDuo={setMinimumDuo}
                retirerDuo={retirerDuo} setRetirerDuo={setRetirerDuo}
                ratioAcompte={ratioAcompte}
              />
            ) : null}
            {etape === 3 ? (
              <EtapeProgramme
                edition={edition} sprint={sprint}
                ville={ville} setVille={setVille}
                format={format} setFormat={setFormat}
                lieu={lieu} setLieu={setLieu}
                niveau={niveau} setNiveau={setNiveau}
                modules={modules} setModules={setModules}
                lancer={lancer} setLancer={setLancer}
                notifier={notifier} setNotifier={setNotifier}
                noteNotification={noteNotification} setNoteNotification={setNoteNotification}
              />
            ) : null}
            {erreurEtape ? <div className="mt-4"><Alerte>{erreurEtape}</Alerte></div> : null}
            {etat.erreur ? <div className="mt-4"><Alerte>{etat.erreur}</Alerte></div> : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-fg/10 bg-bg/40 px-6 py-4">
            <div>
              {etape > 1 ? (
                <button
                  type="button" disabled={enCours}
                  onClick={() => { setErreurEtape(null); setEtape((e) => (e === 3 ? 2 : 1)); }}
                  className="inline-flex items-center gap-1.5 rounded-field border border-fg/20 px-4 py-2 font-mono text-small text-fg/80 transition-colors hover:border-fg/40 hover:text-fg disabled:opacity-40"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
                  <span>Précédent</span>
                </button>
              ) : (
                <button
                  type="button" disabled={enCours} onClick={onFermer}
                  className="rounded-field border border-fg/20 px-4 py-2 font-mono text-small text-fg/65 transition-colors hover:border-fg/40 hover:text-fg disabled:opacity-40"
                >
                  Annuler
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {etape < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (etape === 1 && check1()) setEtape(2);
                    else if (etape === 2 && check2()) setEtape(3);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-field bg-cta px-5 py-2 font-bold text-small text-fg transition-opacity hover:opacity-90"
                >
                  <span>Suivant</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                </button>
              ) : (
                <button
                  type="submit" disabled={enCours}
                  className="inline-flex items-center gap-1.5 rounded-field bg-accent px-5 py-2 font-bold text-small text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <HugeiconsIcon icon={Tick02Icon} size={15} />
                  <span>
                    {enCours
                      ? edition ? "Enregistrement…" : "Création…"
                      : edition ? "Enregistrer les modifications" : "Créer le sprint"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </dialog>
  );
}

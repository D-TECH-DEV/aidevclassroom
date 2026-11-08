import Link from "next/link";
import { redirect } from "next/navigation";

import { exigeSession, sessionPerdue, sprint } from "@/lib/admin/api";
import { ErreurApi } from "@/lib/api";
import { Cadre, Surtitre, TitrePage, Alerte } from "@/components/admin/Briques";
import { FormulaireSprintEdition } from "@/components/admin/FormulaireSprint";

/**
 * `/admin/sprints/:id/modifier` — changer le nom, les prix (solo et
 * duo), les dates et la capacité d'un sprint.
 *
 * Le slug ne se change pas, et le statut se change depuis la liste.
 * Les dossiers existants gardent leur total figé : changer un prix ne
 * touche que les inscriptions à venir.
 */

type Params = { params: Promise<{ id: string }> };

export default async function PageModifierSprint({ params }: Params) {
  await exigeSession();

  const { id: brut } = await params;
  const id = Number(brut);
  if (!Number.isInteger(id) || id <= 0) redirect("/admin/sprints");

  let fiche;
  try {
    fiche = await sprint(id);
  } catch (cause) {
    if (sessionPerdue(cause)) redirect("/admin/connexion");
    if (cause instanceof ErreurApi && cause.statusCode === 404) {
      redirect("/admin/sprints");
    }
    return (
      <>
        <Surtitre>Sessions</Surtitre>
        <TitrePage>Modifier le sprint</TitrePage>
        <div className="mt-6 max-w-[52rem]">
          <Alerte>Impossible de charger ce sprint.</Alerte>
        </div>
      </>
    );
  }

  return (
    <>
      <Surtitre>Sessions</Surtitre>
      <TitrePage>Modifier — {fiche.name}</TitrePage>

      <p className="mt-4 max-w-[60ch] text-body text-fg/60">
        <Link
          href="/admin/sprints"
          className="text-accent underline decoration-accent/40 underline-offset-4"
        >
          ← Retour à la liste
        </Link>
      </p>

      <div className="mt-6 max-w-[52rem]">
        <Cadre titre="Modifier le sprint">
          <div className="px-[clamp(1rem,3vw,1.5rem)] py-[clamp(1rem,3svh,1.5rem)]">
            <FormulaireSprintEdition sprint={fiche} />
          </div>
        </Cadre>
      </div>
    </>
  );
}

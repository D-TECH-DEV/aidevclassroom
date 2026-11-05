import Link from "next/link";

import { exigeSession } from "@/lib/admin/api";
import { Cadre, Surtitre, TitrePage } from "@/components/admin/Briques";
import { FormulaireSprint } from "@/components/admin/FormulaireSprint";

/**
 * `/admin/sprints/nouveau` — créer un sprint, en brouillon ou déjà lancé.
 *
 * La page ne fait que vérifier la session et afficher le formulaire :
 * toute la validation métier vit dans l'action `creerNouveauSprint`.
 */

export default async function PageNouveauSprint() {
  await exigeSession();

  return (
    <>
      <Surtitre>Sessions</Surtitre>
      <TitrePage>Nouveau sprint</TitrePage>

      <p className="mt-4 max-w-[60ch] text-body text-fg/60">
        <Link
          href="/admin/sprints"
          className="text-accent underline decoration-accent/40 underline-offset-4"
        >
          ← Retour à la liste
        </Link>
      </p>

      <div className="mt-6 max-w-[52rem]">
        <Cadre titre="Créer un sprint">
          <div className="px-[clamp(1rem,3vw,1.5rem)] py-[clamp(1rem,3svh,1.5rem)]">
            <FormulaireSprint />
          </div>
        </Cadre>
      </div>
    </>
  );
}

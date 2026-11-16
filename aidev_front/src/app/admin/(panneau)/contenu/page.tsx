import { Suspense } from "react";
import { redirect } from "next/navigation";

import {
  contenuSite,
  exigeSession,
  sessionPerdue,
  traduitAdmin,
} from "@/lib/admin/api";
import { Alerte, Surtitre, TitrePage } from "@/components/admin/Briques";
import { FormulaireContenu } from "@/components/admin/FormulaireContenu";

export default async function PageContenuAdmin() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Surtitre>Éditorial</Surtitre>
        <TitrePage>Contenu vitrine</TitrePage>
      </div>

      <Suspense
        fallback={
          <p className="font-mono text-small text-fg/50">Chargement…</p>
        }
      >
        <ContenuCharge />
      </Suspense>
    </div>
  );
}

async function ContenuCharge() {
  await exigeSession();
  try {
    const donnees = await contenuSite();
    return <FormulaireContenu initial={donnees} />;
  } catch (cause) {
    if (sessionPerdue(cause)) redirect("/admin/connexion");
    return <Alerte>{traduitAdmin(cause)}</Alerte>;
  }
}

import { Suspense } from "react";
import { redirect } from "next/navigation";

import {
  contenuSite,
  exigeSession,
  sessionPerdue,
  traduitAdmin,
} from "@/lib/admin/api";
import { Alerte, EnTetePage } from "@/components/admin/Briques";
import { FormulaireContenu } from "@/components/admin/FormulaireContenu";

export default async function PageContenuAdmin() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <EnTetePage
            surtitre="Éditorial"
            titre="Contenu vitrine"
            description="Contact WhatsApp, profils des formateurs et questions fréquentes."
          />
          <p className="font-mono text-small text-fg/50">Chargement…</p>
        </div>
      }
    >
      <ContenuCharge />
    </Suspense>
  );
}

async function ContenuCharge() {
  await exigeSession();
  try {
    const donnees = await contenuSite();
    return <FormulaireContenu initial={donnees} />;
  } catch (cause) {
    if (sessionPerdue(cause)) redirect("/admin/connexion?expiree=1");
    return (
      <div className="flex flex-col gap-6">
        <EnTetePage
          surtitre="Éditorial"
          titre="Contenu vitrine"
          description="Contact WhatsApp, profils des formateurs et questions fréquentes."
        />
        <Alerte>{traduitAdmin(cause)}</Alerte>
      </div>
    );
  }
}

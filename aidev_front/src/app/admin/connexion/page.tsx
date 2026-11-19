import { FormulaireConnexion } from "@/components/admin/FormulaireConnexion";
import { Surtitre } from "@/components/admin/Briques";

/**
 * `/admin/connexion` — la seule page d'administration accessible sans
 * session.
 *
 * Elle n'affiche pas si un e-mail existe ou non : l'API renvoie le même
 * `INVALID_CREDENTIALS` pour un e-mail inconnu, un mot de passe faux et un
 * compte désactivé, et on garde ce choix. Distinguer les trois dirait à un
 * inconnu quels comptes existent.
 */

export default function PageConnexion() {
  return (
    <main className="flex flex-1 items-center justify-center px-[clamp(1rem,4vw,3rem)] py-[clamp(3rem,10svh,6rem)]">
      <div className="w-full max-w-[26rem]">
        <Surtitre>Administration</Surtitre>

        <h1 className="mt-2 text-h2 font-bold leading-[1.1] tracking-tight">
          Connexion
        </h1>

        <p className="mt-3 max-w-[38ch] text-body text-fg/60">
          Réservé aux comptes <span className="font-mono">ADMIN</span> de
          l&apos;API. Les identifiants sont ceux du back-office de Youssouf.
        </p>

        <div className="mt-[clamp(1.5rem,4svh,2.5rem)]">
          <FormulaireConnexion />
        </div>
      </div>
    </main>
  );
}

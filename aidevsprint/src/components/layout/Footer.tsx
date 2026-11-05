/**
 * Pied de page.
 *
 * Transcription du design `Landing — ai-dev-sprint.com@2x.png` :
 * la marque à gauche, le domaine et la ville au centre, le copyright à
 * droite. Trois blocs sur une ligne au-dessus de `lg`, empilés et centrés
 * en dessous — c'est le seul endroit de la page où empiler est juste,
 * trois libellés courts n'ont pas de hiérarchie à préserver.
 *
 * L'année est calculée plutôt qu'écrite en dur : un copyright figé se
 * périme tout seul. `"use cache"` est nécessaire — avec Cache Components,
 * Next 16 refuse de pré-rendre une page qui lit l'heure courante, parce
 * que la valeur changerait d'un rendu à l'autre. La directive dit que
 * cette valeur est figée au build, ce qui est exactement ce qu'on veut
 * pour un site redéployé à chaque édition.
 *
 * La fonction est `async` parce que `"use cache"` l'exige — c'est une
 * contrainte de la directive, pas un besoin du composant.
 */
export async function Footer() {
  "use cache";

  return (
    <footer className="relative border-t border-fg/10 py-[clamp(1.5rem,4svh,2.5rem)]">
      <div
        className="shell flex flex-col items-center gap-[clamp(0.75rem,2svh,1rem)]
                   text-center text-small text-fg/50
                   lg:flex-row lg:justify-between lg:text-left"
      >
        <p className="font-mono text-fg/80">{"{ AIdevsprint }"}</p>

        <p>ai-dev-sprint.com · Yamoussoukro, Côte d&apos;Ivoire</p>

        <p>© {new Date().getFullYear()} AIdevsprint</p>
      </div>
    </footer>
  );
}

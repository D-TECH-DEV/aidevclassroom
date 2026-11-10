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
 * périme tout seul. Le pré-rendu statique fige cette valeur au build,
 * ce qui est exactement ce qu'on veut pour un site redéployé à chaque
 * édition.
 */
export function Footer() {
  return (
    <footer className="relative border-t border-fg/10 py-[clamp(1.5rem,4svh,2.5rem)]">
      <div
        className="shell flex flex-col items-center gap-[clamp(0.75rem,2svh,1rem)]
                   text-center text-small text-fg/50
                   lg:flex-row lg:justify-between lg:text-left"
      >
        <p className="font-mono text-fg/80">{"{ AIdevsprint }"}</p>

        <p>ai-devclassroom.com · Yamoussoukro, Côte d&apos;Ivoire</p>

        <p>© {new Date().getFullYear()} AIdevsprint</p>
      </div>
    </footer>
  );
}

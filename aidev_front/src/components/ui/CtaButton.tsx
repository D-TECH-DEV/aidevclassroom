type Commun = {
  children: React.ReactNode;
  /** `sm` pour la navbar, `lg` pour le hero. */
  taille?: "sm" | "lg";
  /** Occupe toute la largeur disponible — utile dans le menu plein écran. */
  pleineLargeur?: boolean;
  className?: string;
};

/** Un lien : le cas courant, et le seul jusqu'au 2026-10-25. */
type EnLien = Commun & {
  href: string;
  type?: never;
  disabled?: never;
};

/** Un bouton : même pilule, même survol, mais il agit au lieu de mener. */
type EnBouton = Commun & {
  href?: never;
  type: "submit" | "button";
  disabled?: boolean;
  onClick?: () => void;
};

type Props = EnLien | EnBouton;

const Fleche = ({ className }: { className: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    // `transition-[left,right]` et non `transition-all` : on nomme les
    // propriétés animées. Le retour est plus court que l'aller — le
    // système répond vite quand l'utilisateur s'en va.
    className={`absolute w-6 fill-current transition-[left,right]
                duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)]
                group-hover:duration-[220ms] ${className}`}
  >
    <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
  </svg>
);

/**
 * Bouton d'action principal. Un seul composant, utilisé partout.
 *
 * Au repos : contour bleu, texte blanc, fond transparent.
 * Au survol : un disque bleu se déploie depuis le centre et remplit le
 * bouton, le texte glisse vers la droite, la flèche sort par la droite
 * pendant qu'une seconde entre par la gauche. La capsule reste pleinement
 * arrondie, au repos comme au survol.
 *
 * Il rend un `<a>` quand on lui donne un `href`, un `<button>` quand on lui
 * donne un `type`. Les « Réserver ma place » ouvrent la modale et sont donc
 * des boutons (voir `BoutonReserver`), celui du formulaire soumet. Plutôt
 * qu'une seconde pilule qui ressemble à celle-ci, c'est la même, avec la
 * même animation. Malik l'a demandé le 2026-10-20 — un seul bouton
 * « Réserver ma place » sur tout le site.
 *
 * Essayé le 2026-10-20 et abandonné le même jour : le bleu plein au repos,
 * pour coller aux pilules pleines du design. Il obligeait à assombrir le
 * disque au survol — un disque du même bleu sur un fond déjà bleu ne se
 * voit pas — et le bouton se fonçait au lieu de se remplir. Malik a
 * préféré garder le remplissage. Le site s'écarte donc du design sur ce
 * point, en connaissance de cause.
 *
 * Le texte reste blanc au repos comme au survol : du bleu sur l'aurore
 * bleue serait illisible, c'était le défaut de la première version.
 *
 * Le remplissage se fait par `scale` sur un disque, pas par une animation
 * de largeur : seuls `transform` et `opacity` tournent sur le GPU.
 */
export function CtaButton({
  children,
  taille = "lg",
  pleineLargeur = false,
  className = "",
  ...rendu
}: Props) {
  // Les paddings verticaux suivent la hauteur disponible, comme le reste
  // du rythme du hero : sur un écran court le bouton se resserre au lieu
  // de pousser le contenu hors de l'écran.
  const dimensions =
    taille === "sm"
      ? "px-7 py-[clamp(0.5rem,1.6svh,0.875rem)] text-small gap-1"
      : "px-10 py-[clamp(0.75rem,2.4svh,1.375rem)] text-body gap-1";

  const classes = `group relative isolate inline-flex shrink-0 items-center
                   ${pleineLargeur ? "w-full" : "w-fit"}
                   justify-center overflow-hidden rounded-pill
                   border-2 border-cta font-bold text-fg
                   transition-transform duration-[120ms]
                   ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96]
                   disabled:cursor-not-allowed disabled:opacity-60
                   ${dimensions} ${className}`;

  const interieur = (
    <>
      {/* Flèche qui entre par la gauche */}
      <Fleche className="-left-1/4 hoverable:group-hover:left-4" />

      {/* Le disque qui remplit. -z-10 : il passe derrière le texte.

          Sa taille suit celle du bouton au lieu d'être fixe : à 22rem, un
          bouton en pleine largeur — le menu plein écran, le formulaire —
          restait noir à ses deux bouts, le disque ne l'atteignait pas.
          130 % de la largeur couvre la diagonale de n'importe quelle
          pilule plus large que haute, ce qu'elles sont toutes. */}
      <span
        aria-hidden
        className="absolute -z-10 aspect-square w-[130%] scale-0
                   rounded-full bg-cta
                   transition-transform duration-[160ms]
                   ease-[cubic-bezier(0.23,1,0.32,1)]
                   group-hover:duration-[240ms]
                   hoverable:group-hover:scale-100"
      />

      <span
        className="relative -translate-x-3 transition-transform duration-[160ms]
                   ease-[cubic-bezier(0.23,1,0.32,1)]
                   group-hover:duration-[240ms]
                   hoverable:group-hover:translate-x-3"
      >
        {children}
      </span>

      {/* Flèche qui sort par la droite */}
      <Fleche className="right-4 hoverable:group-hover:-right-1/4" />
    </>
  );

  if (rendu.href !== undefined) {
    return (
      <a href={rendu.href} className={classes}>
        {interieur}
      </a>
    );
  }

  return (
    <button
      type={rendu.type}
      disabled={rendu.disabled}
      onClick={rendu.onClick}
      className={classes}
    >
      {interieur}
    </button>
  );
}

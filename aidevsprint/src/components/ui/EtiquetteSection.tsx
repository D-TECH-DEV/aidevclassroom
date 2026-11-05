/**
 * L'étiquette qui ouvre chaque section : `// le problème`.
 *
 * Reprise telle quelle du design : minuscules, police mono, vert accent,
 * précédée d'un `//`. C'est un commentaire de code — le site parle à des
 * développeurs, l'étiquette le dit avant la première phrase.
 *
 * Le `//` est décoratif : il est masqué aux lecteurs d'écran, qui
 * entendraient « barre oblique barre oblique » à chaque section.
 */
export function EtiquetteSection({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-small text-accent">
      <span aria-hidden className="select-none">
        {"// "}
      </span>
      {children}
    </p>
  );
}

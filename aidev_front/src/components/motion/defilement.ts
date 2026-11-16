import type Lenis from "lenis";

/**
 * L'instance Lenis en cours, partagée.
 *
 * `ScrollFluide` la crée et l'enregistre ici ; la modale d'inscription la
 * met en pause le temps qu'elle est ouverte. Sans ça, la molette continue
 * de faire glisser la page derrière le panneau — `overflow: hidden` sur
 * `html` n'y change rien, puisque Lenis déplace la page lui-même au lieu
 * de laisser le navigateur défiler.
 *
 * Un module plutôt qu'un contexte React : `ScrollFluide` est monté dans le
 * layout et la modale dans la page, aucun des deux n'est l'ancêtre de
 * l'autre. Et sous `prefers-reduced-motion` Lenis n'existe pas du tout —
 * les deux fonctions ne font alors rien, ce qui est le comportement voulu.
 */
let courant: Lenis | null = null;

export function enregistreDefilement(lenis: Lenis | null) {
  courant = lenis;
}

export function arreteDefilement() {
  courant?.stop();
}

export function repartDefilement() {
  courant?.start();
}

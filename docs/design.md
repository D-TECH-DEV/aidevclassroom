# Design

Source de vérité visuelle. Les `.pen` de `design/` sont la maquette ;
ce fichier est la version lisible par un agent et par un humain pressé.

## Direction

**Source de vérité : l'affiche** `design/Affiche AIdevsprint #1 – variante
sombre.png`. Tout dérive d'elle.

- **Ambiance** — noir profond, vert électrique, bleu. Lueurs radiales,
  typographie expressive, aucun ornement.
- **Trois adjectifs** — net, technique, sûr de lui.
- **Positionnement à faire ressentir** — « bien utiliser l'IA » : méthode,
  prompts structurés, fichiers de contexte, bases solides. L'IA amplifie un
  développeur qui sait ce qu'il fait. On s'oppose au vibe coding bête,
  pas à l'IA.

### Ce qu'on évite — le site ne doit pas avoir l'air généré par l'IA

- grille de 3 cartes identiques icône + titre + texte
- dégradé violet/bleu générique, glassmorphism par défaut, emoji en guise
  d'icônes
- sections empilées toutes bâties sur le même gabarit
- textes creux type « Révolutionnez votre avenir »

À la place : **mises en page asymétriques**, typographie expressive à grande
échelle, rythme varié entre sections, détails graphiques repris de l'affiche,
micro-interactions soignées.

## Règles non négociables

Contraintes posées par Malik le 2026-10-05. Elles priment sur toute habitude
par défaut. En cas de doute : demander, ne pas trancher seul.

### Unités

| Usage | Unité | Jamais |
|-------|-------|--------|
| Typo, espacements, rayons | `rem` | `px` |
| Largeurs de colonnes, conteneurs | `%`, `fr`, `minmax()` | largeur fixe en `px` |
| Longueur de ligne (confort de lecture) | `ch` | largeur fixe |
| Médias | `aspect-ratio` + largeur fluide | hauteur fixe |
| Bordures, filets 1px | `px` toléré | — |

### L'échelle, pas seulement la disposition

Le responsive ici n'est **pas** « empiler les colonnes en dessous de 768px ».
C'est : **tout change de taille** — texte, boutons, cartes, icônes, espacements,
rayons — proportionnellement à l'écran.

Levier principal (Tailwind 4) : `--spacing` est l'unité de base dont *toutes*
les utilitaires d'espacement et de taille dérivent. La rendre fluide fait
respirer la mise en page entière d'un seul réglage.

```css
@theme {
  /* base d'espacement fluide : tout p-*, gap-*, size-* suit */
  --spacing: clamp(0.25rem, 0.22rem + 0.12vw, 0.34rem);
}
```

Même principe pour chaque pas de la typo. Formule d'un token fluide entre une
largeur mini `Vmin` et maxi `Vmax` :

```
pente     = (taille_max - taille_min) / (Vmax - Vmin)
préférée  = taille_min + pente × (100vw - Vmin)
token     = clamp(taille_min, préférée, taille_max)
```

Plage de référence du projet : **23.4375rem (375px) → 120rem (1920px)**.
Valeurs exactes à figer quand l'échelle typographique sera arrêtée.

### Pas de marges mortes sur grand écran

Interdit : un conteneur `max-width` fixe centré pendant que le reste ne bouge
pas — c'est ce qui produit deux bandes vides sur un 27 pouces.

**Décidé le 2026-10-06 :** le contenu se cadre à **120rem**, mais les marges
latérales restent un **pourcentage** de la largeur et les tokens fluides
continuent de grandir jusque-là. Au-delà de 120rem, la page est centrée — et
comme tout a grandi en chemin, il n'y a pas de bande morte.

Le seul vrai plafond porte sur la **longueur de ligne, en `ch`** (lisibilité) :
un bloc de texte s'arrête vers 70–75ch même si son conteneur est plus large.
C'est le texte qui se limite, jamais la page.

### Pas d'étirement non plus

Grandir n'est pas se déformer. Garde-fous :

- tout `clamp()` a une borne haute — rien ne croît à l'infini ;
- les médias gardent leur `aspect-ratio` ;
- au-delà d'un seuil, on **ajoute des colonnes** plutôt que d'élargir les
  existantes ;
- `repeat(auto-fit, minmax(…, 1fr))` est à surveiller : sur très grand écran il
  étire la dernière rangée. Préférer `auto-fill`, ou un nombre de colonnes
  explicite par palier.

### Grille et espacements

- Grille 12 colonnes, gouttières issues de l'échelle d'espacement.
- Marges latérales identiques à gauche et à droite, sur tous les paliers.
- Rythme vertical régulier : les hauteurs de section sont des multiples de
  l'échelle, pas des valeurs choisies au cas par cas.
- Alignement optique : les éléments d'une même rangée partagent une ligne de
  base, pas seulement un `gap`.

### Paliers

Les paliers corrigent la **composition** (nombre de colonnes, position du menu).
Les **tailles**, elles, sont déjà fluides et n'attendent pas un palier.

| Palier | Largeur | Cible |
|--------|---------|-------|
| base | < 40rem | mobile |
| `md` | 48rem | tablette |
| `lg` | 64rem | petit portable |
| `xl` | 80rem | portable 14-16" |
| `2xl` | 96rem | desktop |
| `3xl` | 120rem | grand écran (à déclarer) |

⚠️ Piège : un MacBook 14" fait 1512px de large, soit **94,5rem — en dessous du
`2xl` par défaut (96rem)**. Un design qui ne « s'ouvre » qu'en `2xl:` ne
s'ouvrira jamais sur cette machine. D'où le palier `xl` à 80rem, et le
`3xl` à déclarer dans `@theme` :

```css
@theme { --breakpoint-3xl: 120rem; }
```

### Composants : requêtes de conteneur

Une carte doit s'adapter à **la place qu'on lui donne**, pas à la largeur de la
fenêtre. La même carte en pleine largeur ou dans une grille de 4 n'a pas la
même mise en forme. On utilise `@container` et les variantes `@sm:`/`@lg:`
plutôt que les paliers de viewport dès qu'un composant est réutilisé dans
plusieurs contextes.

### Mobile : réduire, pas empiler

Passer en mobile n'est pas « mettre tout en colonne et continuer ». Les tailles
descendent avec la largeur : typo plus petite (borne basse des `clamp()`),
marges et gouttières resserrées, rayons et icônes à l'avenant.

Erreurs explicitement proscrites :

| Interdit | À la place |
|----------|-----------|
| Superposer des éléments par héritage du desktop (`absolute` conservé) | Repasser en flux normal et réordonner |
| Boutons étirés sur toute la largeur par réflexe | Largeur = contenu + padding. Le pleine largeur est un **choix**, pas un défaut |
| Garder les tailles desktop et laisser déborder | Réduire texte, marges, gouttières |
| Défilement horizontal | Aucun, jamais |

Deux causes techniques qui produisent ces défauts sans qu'on l'ait demandé :

- un enfant de flex/grid a `min-width: auto` par défaut et refuse de rétrécir
  en dessous de son contenu → débordement horizontal. Correctif : `min-w-0`
  sur l'enfant.
- `align-items: stretch` est la valeur par défaut : un bouton seul dans une
  colonne flex se retrouve étiré sur toute la largeur sans qu'on ait rien
  écrit. Correctif : `items-start` / `self-start`, ou alignement explicite.

Autres règles :

- Cible tactile : **2,75rem minimum** (44px), y compris pour les liens de menu.
- Le survol n'existe pas au doigt : chaque effet de survol a son pendant
  `:active` et `:focus-visible`.
- `prefers-reduced-motion` est respecté partout, sans exception à demander.

### Retraits et animations sur mobile : signaler d'abord

Si un élément gagne à disparaître sur petit écran, ou si une animation devient
illisible, lourde ou contre-intuitive au doigt (parallaxe, scroll inertiel
Lenis, effets au survol, séquences longues) : **je le signale et j'attends
l'accord avant de le retirer ou de le désactiver**, appareil par appareil.

Jamais de suppression silencieuse « parce que ça rend mal en mobile ».

### Interdits sans autorisation explicite

Rien de tout ceci n'apparaît dans le code sans accord préalable :

- ombres portées, `box-shadow`, lueurs, `glow`
- dégradés, `backdrop-blur`, verre dépoli
- rayons de bordure généreux posés « par défaut »
- transitions et `hover` génériques : `opacity`, `scale(1.05)`, changement de
  teinte au hasard
- emoji en guise d'icône
- toute « touche » décorative non demandée

### Survol et états

Chaque effet de survol est **proposé puis validé**, élément par élément
(bouton, carte, lien, image, entrée de menu). La proposition dit : ce qui
change, la durée, la courbe, et ce qui se passe au `:focus-visible` et sur
tactile (où le survol n'existe pas).

Aucun état par défaut n'est appliqué faute de décision.

### Navigation

Le menu est un choix de design, proposé par palier (barre complète, condensée,
plein écran, tiroir) avec sa justification — jamais un burger réflexe.

## Arbitrages avec les skills installés

### Règle de préséance

**Ce document gagne sur tout skill, sans exception.**

Le projet garde volontairement un large éventail de skills (choix du
2026-10-06 : la puissance avant l'économie de tokens). Plusieurs d'entre eux
ont des opinions de design fortes et parfois opposées entre elles —
`design-dna`, `gpt-taste`, `high-end-visual-design`, `minimalist-ui`,
`industrial-brutalist-ui`, `emil-design-eng`, `apple-design`…

Ils sont là comme **boîte à outils, pas comme autorité**. Un skill qui pose une
ombre, un dégradé, un flou ou un survol parce que « c'est la bonne pratique »
se fait arrêter ici : rien de décoratif ne s'applique par défaut, quelle que
soit la source.

Les skills `emilkowalski/skills` (voir
[.claude/skills/README.md](../.claude/skills/README.md#skills-installés))
apportent une vraie expertise sur le mouvement, mais certaines de leurs règles
s'appliquent par défaut. Les points ci-dessous restent à trancher ; tant qu'ils
ne le sont pas, on ne les applique pas.

| Le skill dit | La contrainte projet dit | Statut |
|--------------|--------------------------|--------|
| Tout bouton pressable reçoit `transform: scale(0.97)` au `:active` | Aucun état par défaut sans accord | ⏳ à trancher |
| Exemple de survol : `transform: scale(1.05)` | `scale` générique explicitement proscrit | ⏳ à trancher |
| `filter: blur(2px)` pour masquer une transition imparfaite | Flou interdit sans accord | ⏳ à trancher |
| `apple-design` : ombres portées, matières translucides, profondeur | Ombres interdites sans accord | ⏳ à trancher |
| `pick-ui-library` recommande ses propres bibliothèques | React Bits est déjà le choix | ⚠️ ne pas suivre sans validation |

### Ce qu'ils apportent et qui ne pose aucun problème

À appliquer sans demander, ce sont des corrections de qualité :

- **Courbes sur mesure** — les easings CSS natifs manquent de punch.
  `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`,
  `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`.
  Jamais d'`ease-in` sur une entrée : ça traîne au moment précis où l'œil
  regarde.
- **Durées** — moins de 300ms pour l'UI. Pression 100–160ms, infobulles
  125–200ms, menus 150–250ms, modales 200–500ms. Le narratif marketing peut
  être plus long.
- **Jamais `transition: all`** — nommer les propriétés.
- **Jamais d'entrée depuis `scale(0)`** — partir de `0.95` + `opacity`.
- **N'animer que `transform` et `opacity`** (GPU ; `width`, `height`, `margin`
  déclenchent layout et paint).
- **Sortie plus rapide que l'entrée.**
- **Décalage en cascade** de 30 à 80ms quand plusieurs éléments entrent.
- **Ne pas animer une action déclenchée au clavier** — répétée cent fois par
  jour, l'animation devient une gêne.

### Deux apports qui complètent nos règles mobile

Ils vont plus loin que ce qu'on avait écrit, on les intègre :

- **Survol conditionné au matériel** : `@media (hover: hover) and (pointer: fine)`.
  Sans ça, un tap sur mobile déclenche le survol et l'état reste collé.
- **`prefers-reduced-motion` = moins de mouvement, pas zéro animation.** On
  garde les transitions d'opacité et de couleur qui aident à comprendre ; on
  retire les déplacements. C'est plus juste que de tout couper.

## Méthode : section par section

1. **Proposer** avant de coder : structure, grille, comportement aux paliers,
   effets de survol, et tout composant supplémentaire jugé utile (carrousel,
   onglets, accordéon…) — avec la raison.
2. **Attendre la validation.** Un composant non demandé ne part jamais en code
   sans accord.
3. **Coder** la section seule, responsive sur toute la plage.
4. **Valider** avant de passer à la suivante.

## Tokens

Mesurés au pixel sur `design/Affiche AIdevsprint #1 – variante sombre.png`
(2970×3713) le 2026-10-15. Ce sont des relevés, pas des estimations.

Ils ne vivent pas ici en double : l'implémentation est le bloc `@theme` de
`src/app/globals.css` (Tailwind 4), qui génère à la fois les utilitaires et
les variables CSS. En cas de divergence, `@theme` fait foi.

### Couleurs

| Token | Valeur | Rôle sur l'affiche |
|-------|--------|--------------------|
| `--color-bg` | `#010101` | fond général, noir quasi pur |
| `--color-surface` | `#010F06` | fond de la carte infos |
| `--color-fg` | `#FFFFFF` | titres et texte courant |
| `--color-accent` | `#2EE66B` | badge, pastilles numérotées, labels |
| `--color-cta` | `#0B63F6` | bouton principal |
| `--color-on-accent` | `#03140A` | texte sur fond vert |
| `--color-glow-green` | `#047B1F` | lueur de fond, pas une ombre |
| `--color-glow-blue` | `#01085A` | lueur de fond, bas de page |

### Le dégradé signature

Présent deux fois sur l'affiche — le logo `AI` et « en ligne. » — et relevé
sur toute sa course :

```css
--gradient-signature: linear-gradient(
  100deg, #2EE66B 0%, #24C193 30%, #1A9BBA 55%, #1589CE 75%, #0B63F6 100%
);
```

**Quatre emplacements autorisés, pas un de plus :** hero, CTA principal,
compteur d'inscrits, accents de section. Partout ailleurs, aplat.

### Typographie

| Rôle | Police | Taille |
|------|--------|--------|
| Display | Inter | `clamp(2.5rem, 1.41rem + 4.66vw, 7rem)` |
| H1 | Inter | `clamp(2rem, 1.39rem + 2.59vw, 4.5rem)` |
| H2 | Inter | `clamp(1.5rem, 1.14rem + 1.55vw, 3rem)` |
| H3 | Inter | `clamp(1.25rem, 1.10rem + 0.65vw, 1.875rem)` |
| Corps | Inter | `clamp(1rem, 0.94rem + 0.26vw, 1.25rem)` |
| Légende | Inter | `clamp(0.875rem, 0.84rem + 0.13vw, 1rem)` |
| Technique | JetBrains Mono | labels, compte à rebours, extraits de prompts |

Plage de fluidité : 375px → 1920px. Les deux polices sont sur Google Fonts.

### Espacement et rayons

```css
--spacing: clamp(0.25rem, 0.22rem + 0.12vw, 0.34rem);
--radius-card: 1.5rem;
--radius-field: 0.625rem; /* champs de saisie — voir ci-dessous */
--radius-pill: 9999px;   /* badges et boutons : capsule pleine */
--breakpoint-3xl: 120rem;
```

**Pourquoi un rayon à part pour les champs** (2026-10-25) : à `--radius-card`
sur une boîte haute de 3 rem, l'arrondi atteint la demi-hauteur et le champ
prend la forme d'une capsule — juste au-dessus d'un vrai bouton en capsule,
on ne sait plus lequel des deux se clique.

### Le formulaire d'inscription — une modale

Arrêté le 2026-10-25. Les « Réserver ma place » ouvrent une modale, ils ne
font plus défiler vers une ancre : le visiteur ne perd pas l'endroit où il
lisait. C'est un `<dialog>` natif — piège à focus, Échap, inertie de la page
et couche supérieure sont gratuits et corrects, ce qu'une modale maison rate
presque toujours.

Entrée : fondu + montée d'1 rem en 200 ms, le vocabulaire de `Reveal` en plus
court parce qu'un panneau répond à un clic et non à un défilement. Le fond
est un voile noir à 88 %, **sans flou** — l'aurore du hero est lumineuse, en
dessous de 88 % le compte à rebours restait lisible derrière le panneau.

**Pas de couleur d'alerte dans le système.** Un champ fautif se marque donc
au contraste (bordure et texte en blanc franc) et jamais en vert : le vert
est la couleur de l'accent et du succès, il dirait l'inverse. À trancher si
le besoin revient ailleurs.

### Ombres : aucune

L'affiche est plate. La profondeur vient de **lueurs radiales dans le fond**,
jamais d'un `box-shadow`. Décidé le 2026-10-15 — ne pas réintroduire d'ombres
sans accord explicite.

## Composants : requêtes de conteneur

Une carte doit s'adapter à **la place qu'on lui donne**, pas à la largeur de la
fenêtre. La même carte en pleine largeur ou dans une grille de 4 n'a pas la
même mise en forme. On utilise `@container` et les variantes `@sm:`/`@lg:`
plutôt que les paliers de viewport dès qu'un composant est réutilisé dans
plusieurs contextes.

### Mobile : réduire, pas empiler

Passer en mobile n'est pas « mettre tout en colonne et continuer ». Les tailles
descendent avec la largeur : typo plus petite (borne basse des `clamp()`),
marges et gouttières resserrées, rayons et icônes à l'avenant.

Erreurs explicitement proscrites :

| Interdit | À la place |
|----------|-----------|
| Superposer des éléments par héritage du desktop (`absolute` conservé) | Repasser en flux normal et réordonner |
| Boutons étirés sur toute la largeur par réflexe | Largeur = contenu + padding. Le pleine largeur est un **choix**, pas un défaut |
| Garder les tailles desktop et laisser déborder | Réduire texte, marges, gouttières |
| Défilement horizontal | Aucun, jamais |

Deux causes techniques qui produisent ces défauts sans qu'on l'ait demandé :

- un enfant de flex/grid a `min-width: auto` par défaut et refuse de rétrécir
  en dessous de son contenu → débordement horizontal. Correctif : `min-w-0`
  sur l'enfant.
- `align-items: stretch` est la valeur par défaut : un bouton seul dans une
  colonne flex se retrouve étiré sur toute la largeur sans qu'on ait rien
  écrit. Correctif : `items-start` / `self-start`, ou alignement explicite.

Autres règles :

- Cible tactile : **2,75rem minimum** (44px), y compris pour les liens de menu.
- Le survol n'existe pas au doigt : chaque effet de survol a son pendant
  `:active` et `:focus-visible`.
- `prefers-reduced-motion` est respecté partout, sans exception à demander.

### Retraits et animations sur mobile : signaler d'abord

Si un élément gagne à disparaître sur petit écran, ou si une animation devient
illisible, lourde ou contre-intuitive au doigt (parallaxe, scroll inertiel
Lenis, effets au survol, séquences longues) : **je le signale et j'attends
l'accord avant de le retirer ou de le désactiver**, appareil par appareil.

Jamais de suppression silencieuse « parce que ça rend mal en mobile ».

### Interdits sans autorisation explicite

Rien de tout ceci n'apparaît dans le code sans accord préalable :

- ombres portées, `box-shadow`, lueurs, `glow`
- dégradés, `backdrop-blur`, verre dépoli
- rayons de bordure généreux posés « par défaut »
- transitions et `hover` génériques : `opacity`, `scale(1.05)`, changement de
  teinte au hasard
- emoji en guise d'icône
- toute « touche » décorative non demandée

### Survol et états

Chaque effet de survol est **proposé puis validé**, élément par élément
(bouton, carte, lien, image, entrée de menu). La proposition dit : ce qui
change, la durée, la courbe, et ce qui se passe au `:focus-visible` et sur
tactile (où le survol n'existe pas).

Aucun état par défaut n'est appliqué faute de décision.

### Navigation

Le menu est un choix de design, proposé par palier (barre complète, condensée,
plein écran, tiroir) avec sa justification — jamais un burger réflexe.

## Arbitrages avec les skills installés

### Règle de préséance

**Ce document gagne sur tout skill, sans exception.**

Le projet garde volontairement un large éventail de skills (choix du
2026-10-06 : la puissance avant l'économie de tokens). Plusieurs d'entre eux
ont des opinions de design fortes et parfois opposées entre elles —
`design-dna`, `gpt-taste`, `high-end-visual-design`, `minimalist-ui`,
`industrial-brutalist-ui`, `emil-design-eng`, `apple-design`…

Ils sont là comme **boîte à outils, pas comme autorité**. Un skill qui pose une
ombre, un dégradé, un flou ou un survol parce que « c'est la bonne pratique »
se fait arrêter ici : rien de décoratif ne s'applique par défaut, quelle que
soit la source.

Les skills `emilkowalski/skills` (voir
[.claude/skills/README.md](../.claude/skills/README.md#skills-installés))
apportent une vraie expertise sur le mouvement, mais certaines de leurs règles
s'appliquent par défaut. Les points ci-dessous restent à trancher ; tant qu'ils
ne le sont pas, on ne les applique pas.

| Le skill dit | La contrainte projet dit | Statut |
|--------------|--------------------------|--------|
| Tout bouton pressable reçoit `transform: scale(0.97)` au `:active` | Aucun état par défaut sans accord | ⏳ à trancher |
| Exemple de survol : `transform: scale(1.05)` | `scale` générique explicitement proscrit | ⏳ à trancher |
| `filter: blur(2px)` pour masquer une transition imparfaite | Flou interdit sans accord | ⏳ à trancher |
| `apple-design` : ombres portées, matières translucides, profondeur | Ombres interdites sans accord | ⏳ à trancher |
| `pick-ui-library` recommande ses propres bibliothèques | React Bits est déjà le choix | ⚠️ ne pas suivre sans validation |

### Ce qu'ils apportent et qui ne pose aucun problème

À appliquer sans demander, ce sont des corrections de qualité :

- **Courbes sur mesure** — les easings CSS natifs manquent de punch.
  `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`,
  `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`.
  Jamais d'`ease-in` sur une entrée : ça traîne au moment précis où l'œil
  regarde.
- **Durées** — moins de 300ms pour l'UI. Pression 100–160ms, infobulles
  125–200ms, menus 150–250ms, modales 200–500ms. Le narratif marketing peut
  être plus long.
- **Jamais `transition: all`** — nommer les propriétés.
- **Jamais d'entrée depuis `scale(0)`** — partir de `0.95` + `opacity`.
- **N'animer que `transform` et `opacity`** (GPU ; `width`, `height`, `margin`
  déclenchent layout et paint).
- **Sortie plus rapide que l'entrée.**
- **Décalage en cascade** de 30 à 80ms quand plusieurs éléments entrent.
- **Ne pas animer une action déclenchée au clavier** — répétée cent fois par
  jour, l'animation devient une gêne.

### Deux apports qui complètent nos règles mobile

Ils vont plus loin que ce qu'on avait écrit, on les intègre :

- **Survol conditionné au matériel** : `@media (hover: hover) and (pointer: fine)`.
  Sans ça, un tap sur mobile déclenche le survol et l'état reste collé.
- **`prefers-reduced-motion` = moins de mouvement, pas zéro animation.** On
  garde les transitions d'opacité et de couleur qui aident à comprendre ; on
  retire les déplacements. C'est plus juste que de tout couper.

## Méthode : section par section

1. **Proposer** avant de coder : structure, grille, comportement aux paliers,
   effets de survol, et tout composant supplémentaire jugé utile (carrousel,
   onglets, accordéon…) — avec la raison.
2. **Attendre la validation.** Un composant non demandé ne part jamais en code
   sans accord.
3. **Coder** la section seule, responsive sur toute la plage.
4. **Valider** avant de passer à la suivante.

## Tokens

Ces tokens ne vivent pas ici en double : ils sont implémentés dans le bloc
`@theme` de `src/app/globals.css` (Tailwind 4), qui en génère à la fois les
utilitaires et les variables CSS. Ce tableau est la version lisible — en cas
de divergence, `@theme` fait foi. Voir [stack.md](stack.md#tailwind-4--ce-qui-change).

### Couleurs

| Token | Clair | Sombre | Usage |
|-------|-------|--------|-------|
| `--bg` | | | fond de page |
| `--fg` | | | texte principal |
| `--muted` | | | texte secondaire |
| `--accent` | | | action primaire |
| `--border` | | | séparateurs |

### Typographie

| Rôle | Police | Taille | Graisse | Interlignage |
|------|--------|--------|---------|--------------|
| Display | | | | |
| Titre | | | | |
| Corps | | | | |
| Légende | | | | |

### Espacement et rayons

- Échelle : 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- Rayons : sm / md / lg
- Ombres :

## Composants

Un bloc par composant : à quoi il sert, ses états, ses variantes.

- **Bouton** —
- **Champ** —
- **Carte** —

## Maquettes

| Fichier | Écran | État |
|---------|-------|------|
| `design/…pen` | | |

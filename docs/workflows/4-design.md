# Workflow : Design System & Intégration UI

## Étape 1 : Direction artistique & Tokens
/plan [MODE : ARCHITECTURE]
Agis en tant que Lead Product Designer & Creative Developer pour le domaine : [Secteur métier].
En respectant `docs/design/palette.md` :
1. Définis une identité visuelle propre au métier (refus des templates SaaS génériques sombres/néon).
2. Spécifie la grille (Bento Grid / hiérarchie claire), la typographie éditoriale + data et les micro-interactions légères (CSS pur, `prefers-reduced-motion`).
3. Consigne ou mets à jour les spécifications dans `docs/design/design-tokens.md` sans générer de code applicatif.

## Étape 2 : Intégration & Performance
/goal [MODE : EXÉCUTION]
Implémente la vue [NomDeLaVue] en utilisant exclusivement les variables de `docs/design/design-tokens.md` (aucune couleur, taille ou espacement en dur). Vérifie la réactivité (Mobile/Tablette/Desktop), le lazy loading des médias et l'absence d'erreurs TypeScript/Linter. Mets à jour `docs/SESSION.md`.

## Étape 3 : Revue
/review [MODE : REVUE]
Relis la vue selon `docs/workflows/5-revue-avant-push.md`.

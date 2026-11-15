# Workflow : Refactoring & Évolution Architecturale

## Étape 1 : Cadrage des contraintes
/grill-me [MODE : INTERVIEW]
Je souhaite refactorer le module [NomDuModule] pour [objectif : ex. découplage Clean Architecture / passage multi-sites]. Interroge-moi sur les contraintes de rétrocompatibilité, de migration de données et de performance.

## Étape 2 : Plan de migration
/plan [MODE : ARCHITECTURE]
Analyse le module [NomDuModule] en t'appuyant sur `ARCHITECTURE.md` et `docs/database.md` :
1. Repère les couplages forts et violations DRY.
2. Définis les nouveaux contrats/interfaces et migrations SQL nécessaires.
3. Établis un plan de migration incrémental, en phases indépendantes et réversibles, garantissant zéro régression.

## Étape 3 : Exécution par phase
/goal [MODE : EXÉCUTION]
Exécute **uniquement** la phase [N] du refactoring conformément au plan. Vérifie que tous les tests existants passent au vert, sans en modifier aucun. Fais un commit par phase, puis mets à jour `docs/SESSION.md` et attends ma validation avant la phase suivante.

## Étape 4 : Revue
/review [MODE : REVUE]
Relis la phase terminée selon `docs/workflows/5-revue-avant-push.md`.

## Étape 5 : Capitalisation
/learn [MODE : CAPITALISATION]
Mets à jour `ARCHITECTURE.md` avec la nouvelle structure une fois toutes les phases terminées.

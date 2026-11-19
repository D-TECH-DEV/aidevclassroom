# Workflow : Initialiser un projet de zéro
> Une étape à la fois. Attendre ma validation avant de passer à la suivante.

## Étape 1 : Cadrage contradictoire
/grill-me [MODE : INTERVIEW]
Lis attentivement les spécifications dans `docs/prd/` et `docs/database.md`.
Interroge-moi sur les zones d'ombre, les arbitrages techniques, la sécurité multi-tenant et les cas limites avant tout début de développement.

## Étape 2 : Planification du socle
/plan [MODE : ARCHITECTURE]
En te basant sur `docs/` et nos réponses précédentes, établis le plan d'initialisation :
1. Arborescence cible (scaffolding modulaire).
2. Dépendances requises et versions exactes.
3. Découpage en jalons (Milestones 1, 2, 3...).
4. Génération du fichier `ARCHITECTURE.md` à la racine.

## Étape 3 : Implémentation du socle
/goal [MODE : EXÉCUTION]
Initialise le projet (configuration, dépendances, arborescence, connexion réelle à la base de données et script de seed initial) conformément au plan validé. Assure-toi que le build et les tests de santé passent sans erreur. Mets à jour `docs/SESSION.md`.

## Étape 4 : Revue
/review [MODE : REVUE]
Relis le socle produit selon `docs/workflows/5-revue-avant-push.md`.

## Étape 5 : Capitalisation
/learn [MODE : CAPITALISATION]
Vérifie que `ARCHITECTURE.md` et `AGENTS.md` reflètent fidèlement la structure initialisée. Propose les modifications, applique-les après validation.

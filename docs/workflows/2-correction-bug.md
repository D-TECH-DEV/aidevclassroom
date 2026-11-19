# Workflow : Diagnostic & Résolution de Bug

## Étape 1 : Diagnostic (Sans toucher au code)
/plan [MODE : ARCHITECTURE]
Analyse l'anomalie suivante :
[Coller ici la stack trace, les logs ou le scénario défaillant]

1. Identifie la cause racine (root cause), pas seulement le symptôme.
2. Évalue l'impact sur les autres modules (Web, Mobile, Sync, RLS).
3. Propose un plan de correction étape par étape incluant un test de non-régression qui échoue avant le correctif.

## Étape 2 : Correction & Validation
/goal [MODE : EXÉCUTION]
Applique le correctif validé, rédige le test de non-régression correspondant, exécute la suite de tests complète et vérifie la compilation (et la reconstruction Docker si applicable) jusqu'à ce que tout soit au vert (max 3 tentatives, puis stop et explication). Ne modifie aucun test existant. Mets à jour `docs/SESSION.md`.

## Étape 3 : Revue
/review [MODE : REVUE]
Relis le correctif selon `docs/workflows/5-revue-avant-push.md`.

## Étape 4 : Capitalisation
/learn [MODE : CAPITALISATION]
Documente ce cas limite dans `ARCHITECTURE.md` ou `docs/` si la règle doit prévenir de futures régressions.

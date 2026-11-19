# Workflow : Reprise ou Cartographie d'un projet existant

## Cas A : Première cartographie complète (Audit initial)

/plan [MODE : ARCHITECTURE]
Analyse ce repository de A à Z et génère `ARCHITECTURE.md` à la racine selon ces 4 axes :

1. **Stack & Dépendances :** Langages, frameworks, versions et bibliothèques clés.
2. **Architecture & Organisation :** Pattern global, rôle de chaque dossier et frontières modulaires.
3. **Flux de données & Sécurité :** Points d'entrée, gestion d'état, isolation multi-tenant, APIs et bases de données.
4. **État des lieux :** Ce qui est opérationnel vs TODOs, mocks résiduels et dette technique.
   Ne modifie aucun fichier applicatif.

   Pour les modules déjà existants, fait un scan puis  déduis les PRD et enregistre les dans docs/prd. Pour un mieux comprendre tu peux me poser des questions afin d'être plus orienté dans la redaction des PRD

## Cas B : Démarrage d'une nouvelle session de travail (Sync rapide, y compris après changement d'agent)

/plan [MODE : ARCHITECTURE]
Prends connaissance de `AGENTS.md`, `docs/SESSION.md`, `ARCHITECTURE.md` et des documents pertinents dans `docs/`. Consulte aussi `git status` et `git log -5 --oneline`.

1. Résume en 3 points concis ta compréhension du périmètre technique et des contraintes actives.
2. Indique l'état laissé par la session précédente (reste à faire, pièges connus) et signale toute incohérence entre `docs/SESSION.md` et l'état réel du repo.
3. Reste en attente de mes instructions spécifiques sans modifier aucun fichier.

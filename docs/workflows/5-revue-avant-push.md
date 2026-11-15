# Workflow : Revue avant push (à lancer surtout après un changement d'agent)

/review [MODE : REVUE]
Lecture seule. Analyse `git status` et `git diff` (et `git diff origin/<branche>` si des commits sont déjà faits), puis produis un rapport avec OK / ATTENTION / BLOQUANT pour chaque point :

1. **Mocks et données en dur :** aucune donnée de test hors scripts de seed.
2. **Multi-tenant :** requêtes filtrées par `site_id`, politiques RLS présentes pour toute nouvelle table.
3. **Tests :** aucun test modifié, désactivé ou supprimé sans justification ; tests ajoutés pour le nouveau code ; résultat de la suite complète.
4. **Architecture :** respect de la Clean Architecture, pas de duplication (DRY), `async/await` partout, erreurs gérées explicitement.
5. **Sécurité :** pas de secret, pas de `.env` ni de clé dans le diff.
6. **Périmètre :** aucune modification hors de la tâche demandée.
7. **Conventions :** aucun emoji (front, code, logs, commits, docs) ; nommage conforme à la section 8 de `AGENTS.md` (langue des identifiants, noms natifs respectés).
8. **Git :** commits en français au format `type(portée): description`, atomiques, sans signature de co-auteur ni mention d'outil/IA.
9. **Documentation :** `docs/SESSION.md` à jour ; `ARCHITECTURE.md` à jour si la structure a changé.

Conclus par : « Prêt à pousser » ou la liste des points bloquants. Ne corrige rien.

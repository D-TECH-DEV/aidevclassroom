# Sauvegarde — migrations MySQL d'origine (NE PAS utiliser avec PostgreSQL)

Contenu déplacé depuis `prisma/migrations/` lors de la bascule vers
PostgreSQL : `0001_init/migration.sql` + `migration_lock.toml` (provider
`mysql`).

Pourquoi elles ne sont pas réutilisables telles quelles :

- syntaxe MySQL : backticks, `INT AUTO_INCREMENT`, `ENUM(...)` inline,
  `DATETIME(3)`, `ON UPDATE CURRENT_TIMESTAMP` — invalides en PostgreSQL ;
- la nouvelle baseline `prisma/migrations/0001_init_pg/` est générée depuis
  `prisma/schema.prisma` (provider `postgresql`) et constitue la seule
  référence valide pour `prisma migrate deploy` en production.

Si des données MySQL de développement doivent être conservées, voir la
stratégie d'export/import dans `docs/prod-deploy.md` (jamais automatique).

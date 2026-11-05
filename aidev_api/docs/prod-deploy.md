# Deploiement production — aidev_api + PostgreSQL existant du VPS

Portée : préparer sans rien détruire. Aucune commande ci-dessous ne supprime
conteneur, réseau ou volume. Rien n'est déployé sans autorisation explicite.

## 1. Diagnostic du PostgreSQL existant (sur le VPS)

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Networks}}'
# Réseaux et volumes existants (lecture seule) :
docker network ls
docker volume ls
# Inspecter le conteneur PG (remplacez <pg> par son vrai nom) :
docker inspect <pg> --format '{{.Name}} {{.Config.Image}} {{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
# Version PostgreSQL SANS afficher de mot de passe (compte sur l'env du conteneur) :
docker exec <pg> psql -U postgres -d postgres -tAc 'SELECT version();'
# Bases existantes (noms seuls) :
docker exec <pg> psql -U postgres -d postgres -tAc "SELECT datname FROM pg_database WHERE NOT datistemplate;"
```

Me renvoyer : nom du conteneur, son réseau, version PG, confirmation qu'aucune
base `aidev_*` n'existe déjà. Je figerai alors `PROXY_NETWORK` et le DNS.

## 2. Base et utilisateur dédiés (après validation du §1)

Exécuter dans le conteneur PG (mot de passe fort généré, ex.
`openssl rand -base64 32`, transmis hors dépôt) :

```sql
CREATE USER aidev_app WITH PASSWORD '<A-REMPLACER>';
CREATE DATABASE aidev_db OWNER aidev_app;
-- Permissions minimales : schéma public de CETTE base uniquement.
GRANT CONNECT ON DATABASE aidev_db TO aidev_app;
-- Puis, connecté à aidev_db :
--   GRANT USAGE, CREATE ON SCHEMA public TO aidev_app;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aidev_app;
```

Ne jamais réutiliser le super-utilisateur `postgres` pour l'API, ne jamais
élargir à d'autres bases.

## 3. Secrets et `.env.prod` (sur le VPS, NON versionné)

```bash
cp .env.example .env.prod   # puis éditer : aucun secret réel dans le dépôt
openssl rand -base64 48     # JWT_SECRET (min 32 caractères, déjà validé au boot)
openssl rand -base64 32     # mot de passe aidev_app
```

`DATABASE_URL` attendue :
`postgresql://aidev_app:<mot-de-passe>@<dns-conteneur-pg>:5432/aidev_db?schema=public`
(`<dns-conteneur-pg>` = nom/alias réseau du §1, port interne 5432, jamais
publié). Clés Paystack **live** uniquement en prod (`sk_live_…`, jamais de
`sk_test_…`) ; l'app échoue proprement au démarrage si une variable manque
(`src/config/env.validation.ts`).

## 4. Sauvegarde avant migration (obligatoire)

```bash
docker exec <pg> pg_dump -U postgres -Fc aidev_db > /root/backups/aidev_db-$(date +%F).dump
# Avant la TOUTE PREMIÈRE migration, la base est vide : le dump reste
# la procédure de référence pour chaque évolution ultérieure.
```

## 5. Build, migration, déploiement

```bash
PROXY_NETWORK=<reseau-reel> API_VERSION=$(date +%Y%m%d-%H%M) sh scripts/deploy-prod.sh
# Le script : build → `migrate` one-shot → `api` → attente health /api/v1/health.
```

Contrôles : `docker compose -f docker-compose.prod.yml ps`,
`... logs --tail=50 api`. L'API n'écoute que sur `appnet` (`expose`, pas de
`ports:`) : aucun accès direct depuis Internet.

## 6. Rollback

- **Applicatif** : redéployer le tag précédent —
  `API_VERSION=<tag-precedent> ... up -d api` (conserver les 2 derniers tags).
- **Données** : `pg_restore` du dump du §4 vers une base de secours, jamais
  d'écrasement sans re-vérification :
  `docker exec -i <pg> pg_restore -U postgres -d aidev_restore < dump`.
- Les migrations Prisma ne se « défont » pas : toute régression de schéma
  passe par une nouvelle migration corrective.

## 7. Reverse proxy et HTTPS

Le VPS en possède déjà un : ne rien installer. Deux branchements possibles,
au choix selon l'existant (labels à ajouter dans `docker-compose.prod.yml`) :

- **Traefik** : labels `traefik.enable=true`,
  `traefik.http.routers.aidev.rule=Host(\`api.votre-domaine\`)`,
  `traefik.http.routers.aidev.tls.certresolver=…`, service sur le même réseau.
- **Nginx** : conteneur nginx sur `appnet` avec
  `proxy_pass http://aidev-api:3000;` (+ `proxy_set_header Host`,
  certificats existants réutilisés).

## 8. Données MySQL de développement (si à conserver)

Transfert manuel documenté, jamais automatique :

```bash
# 1. Dump MySQL local (structure + données) :
mysqldump -u sprint -p --databases sprint_platform > /tmp/sprint_mysql.sql
# 2. Conversion vers PostgreSQL (outil dédié, à valider table par table) :
#    pgloader /tmp/sprint_mysql.load   (fichier .load à écrire selon mapping)
# 3. Réconciliation : counts par table + soldes (total - SUM(SUCCESS))
#    comparés avant/après, écarts expliqués avant bascule.
```

Par défaut (dev) : aucune reprise, base PG créée vide par `0001_init_pg`.

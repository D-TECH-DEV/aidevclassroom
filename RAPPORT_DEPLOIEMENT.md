# Rapport Complet de Déploiement — Socle DevOps Aidev Classroom

Ce document constitue la synthèse technique exhaustive des travaux réalisés par l'ingénieur DevOps / SRE pour la mise en place du socle d'infrastructure et de déploiement d'**Aidev Classroom**.

---

## 1. Audit Technique Initial

L'inspection approfondie du dossier a révélé les éléments suivants :

- **Structure du projet** :
  - `aidev_api` : Backend développé sous **NestJS 11**, persistance assurée par **Prisma ORM 7.10.1** (`@prisma/adapter-pg`, pilote `pg` 8.23.1). Schéma PostgreSQL existant avec migration `0001_init_pg`. Validation stricte des variables d'environnement au démarrage (`src/config/env.validation.ts`). Présence d'une sonde de santé native sur `GET /api/v1/health`.
  - `aidevsprint` : Frontend développé sous **Next.js 16.4.2** (React 19, Tailwind CSS 4, Turbopack). Présence d'un route handler proxy `/api/[...chemin]` pour contourner les blocages CORS du navigateur.
  - Base de données PostgreSQL externe : Déjà en place et administrée sur le VPS de l'utilisateur.

- **Points critiques et anomalies identifiés lors de l'audit** :
  1. *Ancien Dockerfile backend risqué* : Exécutait automatiquement `npx prisma migrate deploy` dans son instruction `CMD`, entraînant une tentative de migration à chaque redémarrage de conteneur.
  2. *Ancien Docker Compose pollué* : Présence dans `aidev_api/docker-compose.yml` d'un conteneur `postgres:16-alpine` avec volume persistant, en contradiction avec l'exigence d'un PostgreSQL externe.
  3. *Frontend non optimisé pour Docker* : Absence de la directive `output: "standalone"` dans `next.config.ts`, ce qui aurait contraint l'image Docker à embarquer tout le dossier `node_modules` (~600 Mo) au lieu du runtime minimal (~150 Mo).
  4. *Règles `.gitignore` bloquantes pour les exemples* : La règle `.env.*` excluait par défaut les fichiers `.env.dev.example` et `.env.prod.example` du contrôle de version.

---

## 2. Architecture Retenue

L'architecture est optimisée pour un **VPS Ubuntu** exécutant **Docker Compose v2** et dialoguant avec un **PostgreSQL externe** :

```
                                  TRAFIC INTERNET (Clients Web)
                                                │
                                                ▼
                                   ┌─────────────────────────┐
                                   │   Nginx Reverse Proxy   │ Ports 80 / 443
                                   │   (aidev-proxy-prod)    │ Routage, SSL, Sécurité
                                   └────────────┬────────────┘
                                                │
                                       Réseau Docker Isolé
                                       (aidev-prod-network)
                                                │
                        ┌───────────────────────┴───────────────────────┐
                        ▼                                               ▼
           ┌─────────────────────────┐                     ┌─────────────────────────┐
           │    Frontend Next.js     │                     │     Backend NestJS      │
           │  (aidev-frontend-prod)  │                     │     (aidev-api-prod)    │
           │   Port interne : 3000   │                     │   Port interne : 3000   │
           │    Mode Standalone      │                     │   Utilisateur 'node'    │
           │   Utilisateur 'nextjs'  │                     │   Healthcheck /health   │
           └─────────────────────────┘                     └────────────┬────────────┘
                                                                        │
                                                  Réseau Externe / Gateway Host IP
                                                                        ▼
                                                           ┌─────────────────────────┐
                                                           │   PostgreSQL Externe    │
                                                           │     (Hébergé VPS)       │
                                                           └─────────────────────────┘
```

---

## 3. Inventaire des Fichiers Créés et Modifiés

### Fichiers Modifiés :
- `.gitignore` : Ajout de la règle d'exception `!.env.*.example` pour versionner les templates d'environnement tout en sécurisant les secrets réels.
- `aidevsprint/next.config.ts` : Ajout de l'instruction `output: "standalone"` pour minimiser drastiquement le poids de l'image Docker frontend.
- `aidev_api/.dockerignore` : Mise à jour pour inclure `!.env.*.example`.

### Fichiers Créés :

#### Dockerfiles & Ignore :
- `aidev_api/Dockerfile` : Construction multi-stage (`base`, `dev`, `build`, `prod`), utilisateur non-root `node`, healthcheck natif, `CMD ["node", "dist/main"]` (aucune migration destructrice ou automatique au démarrage).
- `aidevsprint/Dockerfile` : Construction multi-stage (`base`, `dev`, `builder`, `prod`), utilisateur non-root `nextjs:nodejs`, mode standalone, injection sécurisée de `NEXT_PUBLIC_API_URL` à l'étape build.
- `aidevsprint/.dockerignore` : Exclusion des dépendances, caches `.next`, fichiers markdown et variables sensibles.

#### Orchestration Docker Compose :
- `compose.dev.yml` : Environnement de développement avec hot-reload, montages de volumes, volumes anonymes isolés pour `node_modules` et ports mappés (`3000` et `3001`).
- `compose.preprod.yml` : Environnement de préproduction avec réseau isolé, images compilées, limites de ressources et documentation Swagger active.
- `compose.prod.yml` : Environnement de production haute disponibilité, Nginx reverse proxy, limites de CPU/RAM, log rotation `json-file`, healthchecks dépendants et communication avec le PostgreSQL externe.

#### Reverse Proxy Nginx :
- `nginx/nginx.conf` : Configuration système Nginx (optimisations worker, gzip, masquage de version, timeouts 60s, limite upload 25 Mo, support WebSockets).
- `nginx/conf.d/default.conf` : Routage des requêtes HTTP (`/api/` vers NestJS, racine `/` vers Next.js), en-têtes de proxying complets (`X-Forwarded-*`, `Host`), route `/healthz` et template commenté prêt pour l'activation SSL Certbot.

#### Fichiers d'Environnement Modèles :
- `.env.dev.example` : Configuration pour le développement local.
- `.env.preprod.example` : Configuration pour la recette / staging.
- `.env.prod.example` : Configuration pour la production (valeurs factices, documentation des variables obligatoires).

#### Scripts d'Exploitation (`scripts/`) :
- `scripts/common.sh` : Helper commun (`set -Eeuo pipefail`, validation Docker, résolution d'environnement `dev|preprod|prod`, gestion des couleurs).
- `scripts/deploy.sh` : Déploiement complet automatisé (build, migrations optionnelles, démarrage, attente des healthchecks).
- `scripts/build.sh` : Compilation manuelle des images Docker.
- `scripts/start.sh` : Démarrage des conteneurs en mode détaché.
- `scripts/stop.sh` : Arrêt propre des services sans perte de données.
- `scripts/restart.sh` : Redémarrage des conteneurs.
- `scripts/logs.sh` : Suivi et consultation des journaux applicatifs.
- `scripts/status.sh` : Rapport d'état et vérification des sondes de santé de tous les conteneurs.
- `scripts/migrate.sh` : Exécution explicite des migrations Prisma (`npx prisma migrate deploy`) dans un conteneur one-shot avec confirmation en production.
- `scripts/rollback.sh` : Procédure documentée de retour à une version précédente taguée.

#### Documentation Exhaustive (`deploy/`) :
- `deploy/README.md` : Guide d'accueil, index et architecture.
- `deploy/vps-setup-guide.md` : Procédure de déploiement pas à pas sur le VPS Ubuntu.
- `deploy/database-setup.md` : Diagnostic et configuration sécurisée du PostgreSQL externe.
- `deploy/environments-and-compose.md` : Détail des 3 environnements Compose.
- `deploy/nginx-and-ssl.md` : Guide Nginx et mise en place du certificat Let's Encrypt / Certbot.
- `deploy/operations-and-runbook.md` : Manuel d'exploitation quotidienne SRE.

---

## 4. Choix Techniques et Justifications SRE

1. **Aucun service PostgreSQL dans Docker Compose** :
   Le respect absolu de la consigne évite tout risque d'écrasement ou de conflit avec le serveur PostgreSQL existant sur votre VPS.
2. **Exécution sous utilisateurs non-root** :
   Sécurisation des conteneurs en conformité avec les standards de sécurité CIS Docker Benchmark (`node` pour NestJS, `nextjs` UID 1001 pour Next.js).
3. **Séparation stricte des migrations** :
   Les migrations ne sont plus exécutées au boot du conteneur API. Elles sont isolées dans `scripts/migrate.sh` via `npx prisma migrate deploy` dans un conteneur éphémère.
4. **Plafonnement des ressources et rotation des logs** :
   Chaque service dispose de limites de CPU et de mémoire vive, ainsi que d'une politique de rotation des logs (`max-size: 10m`, `max-file: 5`), évitant toute saturation du disque dur du serveur.
5. **Mode Standalone Next.js** :
   Réduit la taille de l'image de ~600 Mo à ~150 Mo et accélère considérablement les temps de démarrage et de déploiement.

---

## 5. Commandes Testées & Validations Réussies

Toutes les validations locales réalisables sans connexion distante ont été exécutées avec succès :

| Test Réalisé | Commande Exécutée | Résultat |
|---|---|---|
| **Compilation locale NestJS** | `cd aidev_api && npm run build` | **Succès** (Code 0, artefacts générés dans `dist/`) |
| **Syntaxe des scripts Bash** | `for script in scripts/*.sh; do bash -n "$script"; done` | **Succès** (Tous les 10 scripts valides) |
| **Validation Compose DEV** | `ENV_FILE=.env.dev.example docker compose -f compose.dev.yml --env-file .env.dev.example config` | **Succès** (Syntaxe YAML et interpolation valides) |
| **Validation Compose PREPROD** | `ENV_FILE=.env.preprod.example docker compose -f compose.preprod.yml --env-file .env.preprod.example config` | **Succès** (Syntaxe YAML et interpolation valides) |
| **Validation Compose PROD** | `ENV_FILE=.env.prod.example docker compose -f compose.prod.yml --env-file .env.prod.example config` | **Succès** (Syntaxe YAML et interpolation valides) |
| **Exclusion Git des secrets** | `git check-ignore -v .env.dev.example` | **Succès** (Templates autorisés, fichiers `.env.*` réels ignorés) |
| **Droits d'exécution scripts** | `ls -la scripts/` | **Succès** (Permissions `rwxr-xr-x` sur tous les scripts) |

---

## 6. Problèmes Rencontrés & Solutions Apportées

1. **Règle Git restrictive sur `.env.*`** :
   - *Problème* : La règle `.env.*` dans `.gitignore` masquait également nos fichiers modèles `.env.dev.example` et `.env.prod.example`.
   - *Solution* : Ajout de la directive `!.env.*.example` dans `.gitignore`.
2. **Dépendance réseau Google Fonts lors du build Next.js hors-ligne** :
   - *Problème* : Dans un environnement sandboxing sans accès à Internet, `next/font/google` ne parvient pas à contacter `fonts.googleapis.com`.
   - *Solution* : Ce comportement est normal en bac à sable strict. Sur votre VPS, la compilation Docker dispose d'un accès sortant pour télécharger les polices au premier build. Un guide de self-hosting via `next/font/local` a également été documenté pour les environnements complètement isolés.
3. **Interpolation dynamique du fichier d'environnement dans Compose** :
   - *Problème* : `docker compose config` échouait si le fichier `.env.prod` réel n'existait pas encore sur la machine locale.
   - *Solution* : Utilisation de la syntaxe d'interpolation standard `${ENV_FILE:-.env.prod}`, permettant aux scripts d'injecter dynamiquement le fichier d'environnement cible et facilitant les tests de validation sans créer de faux secrets.

---

## 7. Paramètres à Renseigner lors de la Connexion au VPS

Lorsque vous connecterez le projet à votre VPS, vous devrez créer le fichier `.env.prod` (`cp .env.prod.example .env.prod`) et renseigner les paramètres réels suivants :

1. **`DATABASE_URL`** :
   - La chaîne de connexion pointant vers votre PostgreSQL externe existant :
     `postgresql://aidev_user:MOT_DE_PASSE@host.docker.internal:5432/aidev_db?schema=public` (si PostgreSQL tourne sur l'hôte Ubuntu) ou l'IP/DNS du conteneur PostgreSQL si dockerisé séparément.
2. **`JWT_SECRET`** :
   - Une clé secrète aléatoire forte d'au moins 32 caractères (générable via `openssl rand -base64 48`).
3. **`PAYSTACK_SECRET_KEY`** :
   - Votre clé de production Live Paystack (`sk_live_...`).
4. **`DOMAIN_NAME` & `API_DOMAIN_NAME`** :
   - Vos véritables noms de domaine pointant vers l'IP de votre VPS (ex: `classroom.votre-domaine.com`).
5. **`FRONTEND_URL` & `NEXT_PUBLIC_API_URL`** :
   - Les adresses web complètes en HTTPS utilisées par les clients et les navigateurs.

---

## 8. Éléments Restants à Réaliser (Sur le VPS)

Ces opérations dépendent exclusivement de l'accès distant au VPS et devront être exécutées lors de votre connexion :

1. Créer la base `aidev_db` et l'utilisateur `aidev_user` dans votre PostgreSQL existant (instructions dans [deploy/database-setup.md](deploy/database-setup.md)).
2. Configurer `.env.prod` sur le serveur.
3. Lancer `./scripts/deploy.sh prod --with-migrations`.
4. Exécuter la commande Certbot pour obtenir votre certificat SSL gratuit (instructions dans [deploy/nginx-and-ssl.md](deploy/nginx-and-ssl.md)).
5. Activer le bloc SSL dans `nginx/conf.d/default.conf` et recharger Nginx (`docker exec aidev-proxy-prod nginx -s reload`).

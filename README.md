# Aidev Classroom (`aidevclassroom`)

Plateforme de gestion et d'inscription aux sessions de formation intensives **AIdevsprint** : site vitrine public, tunnel d'inscription (forfaits Solo et Duo) avec paiement échelonné Paystack / Mobile Money en XOF, suivi participant par jeton sécurisé et back-office d'administration.

---

## 1. Présentation de l'architecture

Le dépôt est un monorepo regroupant deux applications TypeScript découplées orchestrées par Docker Compose :

- **`aidev_api` (Backend REST)** : NestJS 11, TypeScript `5.7.3`, Prisma `7.10.1` (`@prisma/adapter-pg`), PostgreSQL, Passport JWT, `bcrypt`, `@nestjs/throttler`, `@nestjs/swagger` et intégration Paystack REST + Webhook HMAC-SHA512.
- **`aidevsprint` (Frontend Web & BFF Admin)** : Next.js `16.4.2` (App Router, `output: "standalone"`), React `19.3.0`, Tailwind CSS `^4`, GSAP `^3.15.0`, Lenis `^1.3.27` et Three.js `^0.180.0`.
- **PostgreSQL** : hébergé en conteneur local en développement (`compose.dev.yml`), et externe aux conteneurs applicatifs en préproduction et production.
- **Nginx (`nginx:1.27-alpine`)** : reverse proxy utilisé en `preprod` et `prod` pour router `/api/v1/` vers le backend et `/` + `/api/` (relais même-origine) vers le frontend.

---

## 2. Documentation de référence

- Architecture complète (4 axes) : [ARCHITECTURE.md](ARCHITECTURE.md)
- Directives système et standards d'ingénierie : [AGENTS.md](AGENTS.md)
- État de passation de session : [docs/SESSION.md](docs/SESSION.md)
- Spécifications produit (PRDs) : [docs/prd/README.md](docs/prd/README.md)
  - [01 - Authentification et administrateurs](docs/prd/01-authentification-et-administrateurs.md)
  - [02 - Sprints et catalogue](docs/prd/02-sprints-et-catalogue.md)
  - [03 - Inscriptions et participants](docs/prd/03-inscriptions-et-participants.md)
  - [04 - Paiements et Paystack](docs/prd/04-paiements-et-paystack.md)
  - [05 - Dashboard et administration](docs/prd/05-dashboard-et-administration.md)
  - [06 - Vitrine et parcours public](docs/prd/06-vitrine-et-parcours-public.md)
- Guides d'exploitation et déploiement VPS : [deploy/README.md](deploy/README.md)

---

## 3. Prérequis

- **Docker Engine** et **Docker Compose v2** (`docker compose`)
- **Git**

Pour un lancement hors conteneurs (développement natif) : Node.js 22+ et PostgreSQL 16+.

---

## 4. Démarrage rapide avec Docker (Développement)

### 4.1 Initialisation de la configuration et des hooks Git

Depuis la racine du dépôt :

```bash
# 1. Activer le hook de validation des messages de commit (.githooks/commit-msg)
./setup.sh
# (Sous Windows PowerShell : git config core.hooksPath .githooks)

# 2. Créer le fichier d'environnement local de développement
cp .env.dev.example .env.dev
```

Note : `.env.dev` est ignoré par Git (`.gitignore`). En environnement local, pensez à renseigner votre clé de test `PAYSTACK_SECRET_KEY` (`sk_test_...`) si vous testez le flux Paystack réel.

### 4.2 Construction, démarrage, migrations et seed

```bash
# Construire les images dev et démarrer postgres, backend et frontend
docker compose -f compose.dev.yml --env-file .env.dev up -d --build

# Appliquer les migrations PostgreSQL
docker exec aidev-api-dev npx prisma migrate deploy

# Peupler la base avec les sprints de démonstration et l'administrateur initial
docker exec aidev-api-dev npm run prisma:seed
```

Avec Bash (Linux/macOS/Git Bash), les scripts d'exploitation équivalents sont disponibles :

```bash
./scripts/start.sh dev
./scripts/migrate.sh dev --seed
```

### 4.3 URLs locales et comptes par défaut

Une fois les trois conteneurs (`aidev-postgres-dev`, `aidev-api-dev`, `aidev-frontend-dev`) sains :

| Service | URL locale |
|---|---|
| Site vitrine public | `http://localhost:3000` |
| Panneau d'administration | `http://localhost:3000/admin` |
| Page de reprise de paiement | `http://localhost:3000/paiement/reprendre` |
| API REST (préfixe `/api/v1`) | `http://localhost:3001/api/v1` |
| Sonde de santé API + PostgreSQL | `http://localhost:3001/api/v1/health` |
| Documentation Swagger (`SWAGGER_ENABLED=true`) | `http://localhost:3001/api/docs` |
| PostgreSQL dev | `localhost:5432` (base `aidev_dev`) |

Identifiants administrateur créés par `prisma/seed.ts` avec `.env.dev.example` :
- **E-mail :** `admin@aidev.local` (repli sans variable `SEED_ADMIN_EMAIL` : `admin@example.com`)
- **Mot de passe :** `DevPassword123!` (repli sans variable `SEED_ADMIN_PASSWORD` : `ChangeMe123!`)

Pour créer un nouvel administrateur manuellement :

```bash
docker exec -it aidev-api-dev npm run admin:create -- email@exemple.com "Nom Admin" "MotDePasseFort123"
```

---

## 5. Structure du dépôt

```text
aidevclassroom/
|-- .github/workflows/       # Pipeline CI/CD production (ci-deploy-prod.yml)
|-- .githooks/               # Hook commit-msg (format de commit en français)
|-- aidev_api/               # Backend NestJS 11 + Prisma 7 + tests Jest
|   |-- prisma/              # Schéma PostgreSQL, migrations et seed.ts
|   |-- src/                 # Modules métier (auth, admins, students, sprints, enrollments, payments, dashboard, health)
|   |-- test/                # Tests E2E NestJS (fauxPrisma + fauxFetch)
|   `-- Dockerfile
|-- aidevsprint/             # Frontend Next.js 16 (App Router, Tailwind CSS v4, GSAP, Lenis, Three.js)
|   |-- public/              # Portraits et textures badges 3D
|   |-- src/
|   |   |-- app/             # Pages publiques (/), paiement (/paiement/*), relais (/api/*), panneau (/admin/*)
|   |   |-- components/      # Composants UI, sections landing, modale d'inscription, composants admin
|   |   |-- lib/             # Clients API, adaptation Edition, logique paiement/localStorage, session admin
|   |   `-- proxy.ts         # Garde d'accès Next.js sur /admin/*
|   `-- Dockerfile
|-- deploy/                  # Documentation d'exploitation VPS, Nginx, SSL et base de données
|-- docs/                    # Base de connaissances (SESSION.md, prd/, workflows/, design/)
|-- nginx/                   # Configuration Nginx interne (preprod et prod)
|-- scripts/                 # Scripts Bash d'exploitation Docker Compose
|-- compose.dev.yml          # Stack développement (PostgreSQL en conteneur + backend + frontend)
|-- compose.preprod.yml      # Stack préproduction (backend + frontend + proxy Nginx)
|-- compose.prod.yml         # Stack production (limites ressources + réseau externe main-network)
|-- .env.dev.example         # Modèle variables dev
|-- .env.preprod.example     # Modèle variables preprod
|-- .env.prod.example        # Modèle variables prod
`-- AGENTS.md                # Règles système et standards d'ingénierie
```

---

## 6. Scripts d'exploitation et commandes utiles

### 6.1 Scripts Bash (`scripts/`)

| Script | Usage | Rôle |
|---|---|---|
| `scripts/start.sh` | `./scripts/start.sh [dev\|preprod\|prod] [service]` | Démarre les conteneurs en arrière-plan puis affiche l'état |
| `scripts/stop.sh` | `./scripts/stop.sh [dev\|preprod\|prod]` | Arrête les conteneurs (`down` sans suppression de volumes) |
| `scripts/restart.sh` | `./scripts/restart.sh [dev\|preprod\|prod] [service]` | Redémarre tout ou un service spécifique |
| `scripts/build.sh` | `./scripts/build.sh [dev\|preprod\|prod] [service]` | Construit les images Docker |
| `scripts/migrate.sh` | `./scripts/migrate.sh [dev\|preprod\|prod] [--seed]` | Exécute `prisma migrate deploy` (et `--seed` optionnel) via un conteneur éphémère |
| `scripts/deploy.sh` | `./scripts/deploy.sh [dev\|preprod\|prod] [--with-migrations]` | Build, migrations optionnelles, démarrage et attente healthchecks (90s) |
| `scripts/ci-deploy.sh` | `./scripts/ci-deploy.sh prod` | Déploiement non interactif CI/CD avec vérification HTTP et rollback applicatif auto en cas d'échec |
| `scripts/rollback.sh` | `./scripts/rollback.sh [dev\|preprod\|prod] <TAG_API> [TAG_FRONT]` | Restaure des tags d'images précédents (n'annule pas les migrations Prisma) |
| `scripts/logs.sh` | `./scripts/logs.sh [dev\|preprod\|prod] [service] [-f]` | Consulte les journaux des conteneurs |
| `scripts/status.sh` | `./scripts/status.sh [dev\|preprod\|prod]` | Affiche l'état des conteneurs et leur statut de healthcheck |

### 6.2 Commandes de développement applicatif

**Backend (`aidev_api`) :**

```bash
# Tests unitaires et E2E
docker exec aidev-api-dev npm test
docker exec aidev-api-dev npm run test:e2e

# Contrôle lint et compilation
docker exec aidev-api-dev npm run lint
docker exec aidev-api-dev npm run build
```

**Frontend (`aidevsprint`) :**

```bash
# Vérification stricte TypeScript et compilation Next.js
docker exec aidev-frontend-dev npx tsc --noEmit
docker exec aidev-frontend-dev npm run build
```

---

## 7. Environnements et CI/CD

| Environnement | Fichier Compose | Base de données | Proxy Nginx | Port hôte |
|---|---|---|---|---|
| `dev` | `compose.dev.yml` | Conteneur `aidev-postgres-dev` (volume `aidev-pgdata-dev`) | Non (accès direct `:3000` / `:3001`) | Frontend `3000`, Backend `3001`, PG `5432` |
| `preprod` | `compose.preprod.yml` | PostgreSQL externe (`DATABASE_URL`) | Conteneur `aidev-proxy-preprod` | `8080` / `8443` |
| `prod` | `compose.prod.yml` | PostgreSQL externe sur `main-network` | Conteneur `aidev-proxy-prod` derrière Nginx Proxy Manager | `127.0.0.1:8081` |

**Pipeline GitHub Actions (`.github/workflows/ci-deploy-prod.yml`) :**
À chaque push sur `main`, le workflow exécute en parallèle :
1. `verifier-frontend` : `npm ci`, `npx tsc --noEmit`, `npm run build` dans `aidevsprint/`.
2. `verifier-backend` : `npm ci`, `npx prisma generate` (URL factice de build), `npm test`, `npm run build` dans `aidev_api/`.
3. `deployer-prod` : connexion SSH stricte vers le VPS, `git reset --hard origin/main` et `./scripts/ci-deploy.sh prod`.

---

## 8. Standards d'ingénierie et règles Git

Ce projet applique les directives définies dans [AGENTS.md](AGENTS.md) :

- **Zéro mock en dur en base de production** et **zéro emoji / pictogramme Unicode** dans le code, les logs, la documentation et les commits.
- **Format de commit obligatoire** (vérifié par `.githooks/commit-msg`) : `type(portee): description courte` en français (types : `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf` ; 72 caractères max en première ligne ; aucune mention de co-auteur ou d'outil IA ; `--no-verify` interdit).
- **Sécurité des secrets** : ne jamais commiter `.env`, `.env.dev`, `.env.preprod`, `.env.prod`, clés JWT ou clés Paystack `sk_live_`.


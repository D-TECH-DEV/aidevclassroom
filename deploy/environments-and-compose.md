# Environnements et Fichiers Docker Compose — Aidev Classroom

Ce document détaille les trois fichiers Docker Compose du projet : un fichier unique pour les tests et la préproduction, et deux fichiers complets pour la production (VPS autonome sans Coolify, et déploiement Coolify).

---

## 1. Vue d'Ensemble des Fichiers Compose

| Environnement | Fichier Compose | Modèle d'Environnement | Usage |
|---|---|---|---|
| **Test / Préproduction** | `compose.dev.yml` | `.env.dev.example` | Développement local, tests et validation préprod (via `--profile preprod`) |
| **Production VPS autonome** | `compose.prod.yml` | `.env.prod.example` | Déploiement complet sur VPS nu sans Coolify (PostgreSQL + API + Front + Nginx) |
| **Production Coolify** | `compose.coolify.yml` | `.env.coolify.example` | Déploiement complet sur Coolify (PostgreSQL + Migrate + API + Front + Nginx) |

---

## 2. Environnement Unifié Test / Préproduction (`compose.dev.yml`)

### Services inclus :
- `postgres` (`aidev-postgres-dev`, volume `aidev-pgdata-dev`, port `5432`)
- `backend` (`aidev-api-dev`, `./aidev_api:/app`, hot-reload NestJS sur `:3001`)
- `frontend` (`aidev-frontend-dev`, `./aidev_front:/app`, Next.js Turbopack sur `:3000`)
- `proxy` (`aidev-proxy-dev`, sous `profiles: ["preprod"]`, Nginx sur `:8080` / `:8443`)

### Lancement :
```bash
cp .env.dev.example .env.dev

# Mode développement / test standard
./scripts/start.sh dev
./scripts/migrate.sh dev --seed

# Mode validation préprod avec proxy Nginx
docker compose -f compose.dev.yml --profile preprod --env-file .env.dev up -d
```

---

## 3. Production VPS sans Coolify (`compose.prod.yml`)

### Caractéristiques :
- **Stack 100 % autonome** : inclut `postgres` (`aidev-pgdata-prod`), `backend`, `frontend` et `proxy` Nginx.
- **Ports publics** : `proxy` écoute sur `${HTTP_PORT:-80}` et `${HTTPS_PORT:-443}` avec support Certbot (`certbot-etc`, `certbot-var`).
- **Sécurité et ressources** : utilisateurs non-root (`node` et `nextjs`), base PostgreSQL non exposée sur l'hôte, plafonnement CPU/RAM et rotation des logs `json-file`.

### Déploiement initial sur VPS :
```bash
cp .env.prod.example .env.prod
# Renseigner les secrets (POSTGRES_PASSWORD, JWT_SECRET, PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY...)
./scripts/deploy.sh prod --with-migrations
```

---

## 4. Production Coolify (`compose.coolify.yml`)

### Caractéristiques spécifiques Coolify :
- **Aucun `container_name` fixe** : permet à Coolify de gérer librement le nommage et les déploiements parallèles.
- **Aucun port publié sur l'hôte** : évite tout conflit sur les ports `80`/`443` occupés par Traefik (proxy frontal de Coolify).
- **Routage simplifié** : seul le service `proxy` expose le port interne `80` (`expose: ["80"]`). Associez votre domaine public dans Coolify sur le service `proxy` (port `80`), et Nginx se chargera de router `/api/v1/` vers `backend` et `/` + `/api/` vers `frontend`.
- **Migrations automatiques** : le service one-shot `migrate` exécute `npx prisma migrate deploy` dès que `postgres` est sain, avant le démarrage de `backend`.

### Déploiement sur Coolify :
1. Créer une ressource **Docker Compose** pointant vers `compose.coolify.yml`.
2. Copier les variables de `.env.coolify.example` dans l'onglet *Environment Variables* de Coolify.
3. Configurer le domaine (ex. `https://classroom.votre-domaine.com`) sur le service `proxy` port `80`.
4. Déployer. Pour créer le premier administrateur après le déploiement :
   `npm run admin:create -- email@exemple.com "Nom Admin" "MotDePasseFort123"` dans le terminal du conteneur `backend`.

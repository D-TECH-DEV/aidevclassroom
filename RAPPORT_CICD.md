# Rapport CI/CD — Aidev Classroom

Date : 2026-11-07. Mission : chaque `git push origin main` teste, construit
et déploie automatiquement la production sur le VPS.

## 1. Ancienne architecture

Aucun pipeline. Pas de dossier `.github/`, aucun workflow.
Déploiement 100 % manuel en SSH : `git pull`, `./scripts/deploy.sh prod`
(option `--with-migrations`), vérification via `./scripts/status.sh`.
Scripts existants : `build.sh`, `common.sh`, `deploy.sh`, `logs.sh`,
`migrate.sh`, `restart.sh`, `rollback.sh`, `start.sh`, `status.sh`, `stop.sh`.

## 2. Problèmes identifiés (audit)

1. **Aucune CI/CD** : pas de tests ni de build automatiques avant mise en
   production.
2. **`main` vide** : `main` local et `origin/main` ne contiennent que
   `.gitignore`. Tout le projet vit sur `infra` / `origin/infra`. Un push
   de `main` en l'état déploierait un dépôt vide. La fusion `infra` → `main`
   reste à faire (action manuelle, voir §8).
3. **`migrate.sh` et `rollback.sh` interactifs** : invite `oui/non`
   obligatoire en production, incompatible avec un runner CI.
4. **Faux risque écarté après vérification** : `NEXT_PUBLIC_API_URL`
   (`http://backend:3000/api/v1`) semblait injoignable depuis un navigateur,
   mais le code (`aidevsprint/src/lib/api.ts`) ne l'utilise que côté serveur
   (le navigateur passe par le relais même-origine `/api`, route
   `src/app/api/[...chemin]/route.ts`). La valeur est donc correcte sur le
   réseau Compose. Elle est injectée au build : chaque déploiement
   reconstruit, donc toute modification de `.env.prod` est prise en compte.
5. **Pas de vérification HTTP réelle** : `deploy.sh` ne contrôlait que les
   healthchecks Docker, jamais le trafic via Nginx.
6. **Aucun secret GitHub** : rien à réutiliser, tout est à créer (§5).
   Pas de CLI `gh` authentifiée sur le VPS : création manuelle côté GitHub.
7. **Accès Docker restreint** : le socket `/var/run/docker.sock` exige des
   privilèges élevés (constaté pendant l'audit, sans impact sur le pipeline).

## 3. Nouvelle architecture

Un seul workflow [`.github/workflows/ci-deploy-prod.yml`](.github/workflows/ci-deploy-prod.yml),
déclenché **uniquement sur push vers `main`**, avec
`concurrency: deploy-prod` (`cancel-in-progress: false`, une seule
exécution à la fois) :

| Job | Rôle |
|---|---|
| `verifier-frontend` | `npm ci`, `tsc --noEmit`, `npm run build` (Next.js) |
| `verifier-backend` | `npm ci`, `prisma generate` (URL factice), `npm test`, `npm run build` (NestJS) |
| `deployer-prod` (`needs` les deux) | SSH vers le VPS puis `./scripts/ci-deploy.sh prod` |

Tout échec de vérification bloque le déploiement (`needs`, pas de build ni
de déploiement inutile). Le job de déploiement échoue vite si SSH est
injoignable (`BatchMode=yes`, `ConnectTimeout=15`).

Séquence côté VPS ([`scripts/ci-deploy.sh`](scripts/ci-deploy.sh),
non interactif) : `git fetch` + `git reset --hard origin/main` (effectué
par le workflow avant l'appel) → mémorisation des images en cours →
`deploy.sh prod --with-migrations` (build, `prisma migrate deploy`
idempotent, `up -d`, attente healthchecks 90 s) → `curl` réels via le
proxy local (8081) : `/healthz`, `/`, `/api/v1/health` → en cas d'échec,
**retour arrière applicatif** vers les images mémorisées
(`rollback.sh` non interactif + reverification), sortie en erreur explicite
(`ROLLBACK_OK`, `ROLLBACK_PARTIEL` ou `ROLLBACK_IMPOSSIBLE` — aucun
rollback n'est prétendu sans avoir été exécuté).

PostgreSQL : inchangé. Aucun service PG dans
[`compose.prod.yml`](compose.prod.yml), aucun volume touché, aucune donnée
modifiée, aucune commande destructive (`down -v`, `prune --volumes`
interdits et absents du dépôt). Les migrations ne font jamais de seed
automatique en production.

## 4. Fichiers créés ou modifiés (branche `infra`, non commités)

- Créé : `.github/workflows/ci-deploy-prod.yml` (pipeline complet).
- Créé : `scripts/ci-deploy.sh` (déploiement CI + vérification HTTP +
  retour arrière). Exécutable.
- Modifié : `scripts/migrate.sh` — `MIGRATE_AUTO_CONFIRM=oui` saute l'invite
  (comportement local inchangé par défaut).
- Modifié : `scripts/rollback.sh` — `ROLLBACK_AUTO_CONFIRM=oui` saute
  l'invite + 3e argument optionnel `TAG_FRONTEND` (défaut : même tag que
  l'API). Comportement local inchangé par défaut.
- Créé : ce rapport (`RAPPORT_CICD.md`).

## 5. Secrets GitHub à configurer

Settings → Secrets and variables → Actions → New repository secret :

- `VPS_HOST` — hôte SSH public du VPS (IP ou domaine). Exemple : adresse IP
  publique du VPS.
- `VPS_USER` — utilisateur SSH. Ici `root` (projet sous `/root/...`).
- `VPS_PORT` — port SSH. Ici `22` (défaut, `sshd_config` sans `Port`
  personnalisé).
- `VPS_SSH_KEY` — contenu d'une **clé privée ED25519 dédiée** (générée pour
  le déploiement, jamais réutilisée ailleurs). Clé publique correspondante
  à ajouter dans `~/.ssh/authorized_keys` du VPS.
- `VPS_KNOWN_HOSTS` — sortie exacte de :
  `ssh-keyscan -p <VPS_PORT> <VPS_HOST>` (une ligne `HOST ... ssh-ed25519 ...`).

Aucun autre secret : `DATABASE_URL`, `JWT_SECRET`, clés Paystack, etc.
restent dans `.env.prod` sur le VPS (fichier ignoré par Git, `chmod 600`),
jamais dans le dépôt ni dans GitHub. `StrictHostKeyChecking` n'est jamais
désactivé : la clé d'hôte est vérifiée via `VPS_KNOWN_HOSTS` et le workflow
refuse de continuer si l'hôte n'y figure pas.

## 6. Opérations effectuées sur le VPS

- Lecture seule : état Git, contenus Compose/Dockerfiles/Nginx/scripts,
  `prisma migrate status` (base **à jour**, 1 migration, rien en attente),
  conteneurs et réseaux Docker.
- Builds de validation : `docker compose build backend frontend` (images
  `aidev-api:prod-20261107`, `aidev-frontend:prod-20261107`) — sans
  redémarrer les services.
- Tests backend dans un conteneur jetable sur copie `/tmp` (dépôt non
  pollué, `/tmp` nettoyé ensuite).
- **Déploiement contrôlé** via `./scripts/ci-deploy.sh prod` : rebuild,
  `migrate deploy` (sans effet, base à jour), `up -d`, healthchecks,
  `curl` 200 sur `/healthz`, `/`, `/api/v1/health` (`{"status":"ok",
  "db":"up"}`). Services actifs : `aidev-api-prod`,
  `aidev-frontend-prod` (images `...:20261107-030231`, `healthy`),
  `aidev-proxy-prod` (`healthy`). Aucun retour arrière nécessaire (succès).
- Conteneur `postgres` : uniquement observé (Up, `healthy`) — ni
  redémarré, ni modifié. Aucun volume supprimé.

## 7. Tests réellement réalisés (et résultats)

- `bash -n` sur les 11 scripts : OK.
- Parsing YAML du workflow (déclencheur `push: main`, `concurrency`,
  `needs`, absence de contournement de la vérification d'hôte) : OK.
- `docker compose -f compose.prod.yml --env-file .env.prod config` : OK.
- Build Docker prod backend + frontend depuis le code actuel : OK.
- Tests unitaires backend : **6 suites, 29 tests, tous passés**.
- Frontend : pas de suite de tests dans le dépôt (`dev`/`build`/`start`
  uniquement) — la compilation `next build` (avec contrôle de types, pas
  de `ignoreBuildErrors`) fait office de vérification, en Docker comme en CI.
- Recherche de commandes destructives dans `scripts/`, Compose et workflow :
  aucune (seule mention : commentaire qui les interdit).
- Non testé de bout en bout : le run GitHub Actions lui-même (impossible
  sans les secrets §5 et sans la fusion §8).

Blocages restants : création des 5 secrets par un administrateur GitHub ;
fusion `infra` → `main` (voir §8).

## 8. Procédure après chaque `push` sur `main`

1. Le push déclenche le workflow (tests + builds, ~quelques minutes).
2. Si une vérification échoue : **rien n'est déployé**, le run est rouge,
   la production continue sur la version en cours.
3. Si tout passe : connexion SSH stricte, `git reset --hard origin/main`,
   rebuild, migrations idempotentes, `up -d`, healthchecks, `curl` réels.
4. En cas d'échec au déploiement : retour arrière automatique vers les
   images précédentes + rapport explicite dans les logs du run.

**Mise en service (actions manuelles restantes, dans cet ordre)** :

1. Créer les 5 secrets (§5) sur GitHub.
2. Fusionner vers `main` (branche `infra` relue au préalable) puis pousser.
   C'est ce premier push qui constituera le premier déploiement automatique.
   ```bash
   git checkout main
   git merge infra
   git push origin main
   ```
3. Suivre le run dans l'onglet Actions du dépôt.

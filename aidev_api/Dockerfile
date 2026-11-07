# ==============================================================================
# Dockerfile Backend — Aidev Classroom (NestJS 11 + Prisma 7)
# Multi-stage : base / dev / build / prod. Aucune migration automatique :
# les migrations passent par scripts/migrate.sh (conteneur one-shot).
# ==============================================================================

# ── Étape 1 : Image de base commune ───────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
# libc6-compat : compatibilité binaires ; openssl : moteurs Prisma sur Alpine ;
# wget : healthchecks HTTP.
RUN apk add --no-cache libc6-compat openssl wget

# ── Étape 2 : Cible Développement ─────────────────────────────────────────────
FROM base AS dev
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ── Étape 3 : Cible Compilation / Build ───────────────────────────────────────
FROM base AS build
ENV NODE_ENV=production
COPY package*.json ./
# --include=dev : ENV NODE_ENV=production ferait omettre les devDeps
# (@nestjs/cli, prisma, ts-node), indispensables au build et aux migrations.
RUN npm ci --include=dev
COPY . .
# `prisma generate` lit prisma.config.ts qui exige DATABASE_URL : valeur
# factice de build uniquement (jamais persistée, la prod vient de env_file).
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npx prisma generate && npm run build

# ── Étape 4 : Cible Production Finale ─────────────────────────────────────────
FROM base AS prod
ENV NODE_ENV=production
# node_modules COMPLET (devDeps incluses : prisma CLI + ts-node) car les
# migrations s'exécutent via `docker compose run --rm backend` (migrate.sh).
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health | grep -q '"status":"ok"' || exit 1
# Démarrage pur : aucune migration ni seed ici (voir scripts/migrate.sh).
CMD ["node", "dist/main"]

# ==============================================================================
# Dockerfile Frontend — Aidev Classroom (Next.js 16 Standalone)
# ==============================================================================

# ── Étape 1 : Image de base commune ──────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ── Étape 2 : Cible Développement ────────────────────────────────────────────
FROM base AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── Étape 3 : Cible Compilation / Build ──────────────────────────────────────
FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci

COPY . .

# Injection de la variable d'environnement publique Next.js lors du build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# ── Étape 4 : Cible Production Finale (Standalone) ───────────────────────────
FROM base AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Création d'un utilisateur et d'un groupe système non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copie des fichiers statiques publics
COPY --from=builder /app/public ./public

# Configuration du cache et des permissions
RUN mkdir .next && chown nextjs:nodejs .next

# Copie de l'application standalone et des assets statiques Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Healthcheck HTTP sur la racine du frontend Next.js
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]

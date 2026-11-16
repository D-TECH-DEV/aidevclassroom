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
# --include=dev : ENV NODE_ENV=production ferait omettre les devDeps
# (tailwindcss, typescript...), indispensables au build Next.js.
RUN npm ci --include=dev

COPY . .

# Injection des variables d'environnement publiques Next.js lors du build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ARG NEXT_PUBLIC_PAYSTACK_CHARGE_ENABLED
ENV NEXT_PUBLIC_PAYSTACK_CHARGE_ENABLED=${NEXT_PUBLIC_PAYSTACK_CHARGE_ENABLED}

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

# Healthcheck HTTP sur la racine du frontend Next.js (127.0.0.1 : dans
# l'image Alpine, localhost résout en ::1 et le serveur n'écoute qu'en IPv4)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]

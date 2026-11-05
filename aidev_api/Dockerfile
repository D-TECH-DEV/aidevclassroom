# Production aidev_api (NestJS + Prisma 7 + PostgreSQL externe).
# La DB n'est PAS dans ce Dockerfile : elle est fournie par le VPS.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# `generate` ne se connecte pas : il exige seulement que DATABASE_URL soit
# resolvable (prisma.config.ts est strict). URL factice de build.
RUN DATABASE_URL='postgresql://build:build@localhost:5432/build?schema=public' npx prisma generate
RUN npm run build

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# --omit=dev retire aussi le CLI prisma (devDependency) : on le re-ajoute
# seul pour `prisma migrate deploy`, sans toucher au package.json.
RUN npm ci --omit=dev && npm install --no-save prisma@7
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/prisma ./prisma
COPY --chown=node:node --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
USER node
# Les migrations sont appliquees en premier par le service `migrate`
# (docker-compose.prod.yml) ; ce CMD garde un filet idempotent.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

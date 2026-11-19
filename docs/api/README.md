<!--
  COPIE. Ce dossier est l'archive `frontend.zip` fournie par Youssouf le
  2026-10-27, déposée telle quelle. Ce n'est pas notre documentation : la
  source de vérité est le code du back et le Swagger
  (https://aidev.you-soft.com/api/docs). Si quelque chose ne colle plus,
  c'est cette copie qui a vieilli.

  Nos décisions d'intégration à nous sont dans docs/stack.md § API.
-->

# Documentation frontend — Aidev Classroom API

Guide de démarrage pour intégrer l'API backend (NestJS + Prisma + PostgreSQL + JWT + Paystack).

- **Base publique :** `https://aidev.you-soft.com`
- **Préfixe API :** `/api/v1` (config `API_PREFIX`, défaut `api/v1`, voir [main.ts](../../src/main.ts))
- **Base API réelle :** `https://aidev.you-soft.com/api/v1`
- **Swagger (si activé, `SWAGGER_ENABLED !== 'false'`) :** `https://aidev.you-soft.com/api/docs`
- **Santé :** `GET /api/v1/health` → `{ status, db, time }` (voir [health.controller.ts](../../src/health/health.controller.ts))

Contenu :

- [Authentification et permissions](./authentication.md)
- [Inventaire complet des endpoints](./endpoints.md)
- [Étudiants](./students.md)
- [Sprints et catalogue](./sprints.md)
- [Inscriptions](./enrollments.md)
- [Paiements Paystack](./payments.md)
- [Tableau de bord](./dashboard.md)
- [Erreurs et conventions HTTP](./errors.md)
- [Exemples TypeScript / JavaScript](./examples.md)
- [Contrat OpenAPI](./openapi.json)

## Démarrage en 5 minutes

1. Lisez [authentication.md](./authentication.md) et connectez-vous via `POST /api/v1/auth/login`.
2. Conservez `accessToken` et envoyez `Authorization: Bearer <token>` sur les routes admin.
3. Pour un parcours participant, créez une inscription via `POST /api/v1/enrollments` et conservez le `trackingToken` retourné (il n'est renvoyé qu'à la création).
4. Initialisez un paiement, redirigez vers `authorizationUrl`, puis vérifiez côté serveur via `GET /api/v1/payments/:reference/verify`. Un retour navigateur ne prouve jamais un paiement.
5. Consultez [examples.md](./examples.md) pour un client `fetch` centralisé.

## Conventions globales vérifiées

- Succès : `{ "data": ..., "meta": {} }` via [TransformInterceptor](../../src/common/interceptors/transform.interceptor.ts). Les listes renvoient `{ items, total, page, limit }` (pas de `totalPages`).
- Erreurs : `{ "statusCode": number, "code": string, "message": string }` via [AllExceptionsFilter](../../src/common/filters/http-exception.filter.ts).
- Validation globale : `whitelist + forbidNonWhitelisted + transform`. Tout champ inconnu → `400 BAD_REQUEST`.
- Pagination : `page` défaut 1, `limit` défaut 20, borné 1–100 (`take = clamp`). Tri `createdAt desc` partout.
- Throttle global : 120 req/min ; `POST /auth/login` 10/min ; `POST /students` et `POST /enrollments` 20/min → `429 TOO_MANY_REQUESTS`.
- Dates : ISO 8601 (`2026-03-01T09:00:00.000Z`). Montants : entiers XOF. Devise : `XOF` par défaut.
- CORS : origine `FRONTEND_URL`. JWT : Bearer, durée `JWT_EXPIRES_IN` (défaut `1h`).

## Nombre de routes documentées

38 routes : santé 1, auth 3, admins 5, étudiants 5, sprints 7, inscriptions 6, paiements 6, dashboard 5. Détail dans [endpoints.md](./endpoints.md).

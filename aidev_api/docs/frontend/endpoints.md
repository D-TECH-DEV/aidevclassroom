# Inventaire complet des endpoints (38 routes)

Base : `https://aidev.you-soft.com/api/v1`. Enveloppe succès `{ data, meta }`, listes `{ items, total, page, limit }`. Erreurs `{ statusCode, code, message }`. Détail des schémas : voir pages par module.

## 1. Santé et disponibilité

| Méthode | Chemin | Auth | Rôles | Description |
|---|---|---|---|---|
| `GET` | `/health` | non | — | Liveness + `SELECT 1` Postgres. `200 { data: { status: "ok", db: "up"\|"down", time: ISO } }`. Jamais `401/404`. |

## 2. Authentification

| Méthode | Chemin | Auth | Rôles | Body | Réponse |
|---|---|---|---|---|---|
| `POST` | `/auth/login` | non (10/min) | — | `{ email, password }` | `200 { accessToken, expiresIn, admin }` ; `401 INVALID_CREDENTIALS` |
| `GET` | `/auth/me` | JWT | `ADMIN` | — | admin sans `passwordHash` ; `401 UNAUTHORIZED` |
| `POST` | `/auth/change-password` | JWT | `ADMIN` | `{ currentPassword, newPassword(8–128) }` | admin ; `401 INVALID_CURRENT_PASSWORD` |

## 3. Administration et utilisateurs

Préfixe `/admins`, tout JWT `ADMIN`.

| Méthode | Chemin | Body | Réponse / erreurs |
|---|---|---|---|
| `GET` | `/admins` | — | liste d'admins (sans hash) |
| `GET` | `/admins/:id` | — | fiche ; `400` si id non numérique ; `404 ADMIN_NOT_FOUND` |
| `POST` | `/admins` | `{ name ≤150, email, password 8–128 }`, rôle forcé `ADMIN`, bcrypt 12 | `201` fiche ; `409 ADMIN_EMAIL_EXISTS` |
| `PATCH` | `/admins/:id` | `{ name?, email?, isActive? }` | fiche ; `404` ; `409` e-mail pris ; `400 CANNOT_DISABLE_SELF` si on se désactive |
| `PATCH` | `/admins/:id/disable` | — | fiche désactivée (`isActive: false`) ; mêmes `404`/`CANNOT_DISABLE_SELF` |

## 4. Étudiants

| Méthode | Chemin | Auth | Body / Query | Réponse |
|---|---|---|---|---|
| `POST` | `/students` | non (20/min) | `{ firstName ≤100, lastName ≤100, email, phone }` | `201 { student, created }` (idempotent, jamais 409) |
| `GET` | `/admin/students?page&limit&search` | ADMIN | `search` sur 4 champs | `{ items, total, page, limit }` |
| `GET` | `/admin/students/:id` | ADMIN | — | fiche ; `404 STUDENT_NOT_FOUND` |
| `PATCH` | `/admin/students/:id` | ADMIN | `{ firstName?, lastName?, phone? }` (pas d'e-mail) | fiche ; `404` |
| `GET` | `/admin/students/:id/enrollments` | ADMIN | — | inscriptions + sprint + paiements ; `404` étudiant |

## 5. Sprints et catalogue

| Méthode | Chemin | Auth | Body / Query | Notes |
|---|---|---|---|---|
| `GET` | `/sprints?page&limit` | non | — | `ACTIVE` uniquement |
| `GET` | `/admin/sprints?page&limit&status` | ADMIN | `status?` enum | tous statuts par défaut |
| `GET` | `/sprints/:id` | non | — | `404` si non-`ACTIVE` ou inconnu |
| `POST` | `/sprints` | ADMIN | `CreateSprintDto` complet | `409 SLUG_EXISTS`, `400 MINIMUM_EXCEEDS_PRICE / INVALID_DATES` |
| `PATCH` | `/sprints/:id` | ADMIN | `UpdateSprintDto` (sans `slug`/`status`) | champ inconnu → `400` |
| `PATCH` | `/sprints/:id/status` | ADMIN | `{ status: enum }` | `400 INVALID_STATUS_TRANSITION` |
| `DELETE` | `/sprints/:id` | ADMIN | — | `409 HAS_ENROLLMENTS` si utilisé |

## 6. Inscriptions

| Méthode | Chemin | Auth | Body / Query | Réponse |
|---|---|---|---|---|
| `POST` | `/enrollments` | non (20/min) | `{ sprintId >0, student: {...} }` | `201 { enrollment, trackingToken }` ; `404 SPRINT_NOT_FOUND`, `422 SPRINT_NOT_ACTIVE`, `409 CAPACITY / DUPLICATE` |
| `GET` | `/admin/enrollments?page&limit&sprintId&status&search` | ADMIN | filtres combinables | items enrichis (`totalPaidXof`, `remainingAmountXof`) |
| `GET` | `/admin/enrollments/:id` | ADMIN | — | détail + soldes ; `404` |
| `GET` | `/enrollments/:id/status` | suivi | header/query/body `trackingToken` | résumé + paiements limités ; `401` guard, `404` |
| `PATCH` | `/admin/enrollments/:id/status` | ADMIN | `{ status: enum }` | `400 INVALID_TRANSITION / NOT_SETTLED` |
| `GET` | `/admin/enrollments/:id/payments` | ADMIN | — | paiements ; `404` inscription |

## 7. Paiements

| Méthode | Chemin | Auth | Body | Réponse |
|---|---|---|---|---|
| `POST` | `/payments/enrollments/:id/initialize` | suivi | `{ amountXof >0 }` | `201 { paymentId, reference, status: PENDING, authorizationUrl }` ; `400/409/422` montants, `503` Paystack |
| `GET` | `/payments/:reference/verify` | ADMIN ou suivi | — | paiement + soldes ; `502` / `422 MISMATCH` / `404` |
| `POST` | `/payments/webhook/paystack` | signature Paystack | brut JSON Paystack | `200 { data, meta }` ; `400 INVALID_WEBHOOK_*` |
| `GET` | `/admin/payments?page&limit&enrollmentId&status&reference` | ADMIN | — | `{ items, total, page, limit }` |
| `GET` | `/admin/payments/:id` | ADMIN | — | fiche ; `404 PAYMENT_NOT_FOUND` |
| `POST` | `/admin/payments/:id/recheck` | ADMIN | — | même effet que `verify` |

## 8. Tableau de bord (tout ADMIN, préfixe `/admin/dashboard`)

| Méthode | Chemin | Query | Réponse |
|---|---|---|---|
| `GET` | `/admin/dashboard/summary` | — | totaux, encaissé, restes, pendings, 10 récents |
| `GET` | `/admin/dashboard/recent-enrollments` | `limit` 1–50 (déf. 10) | liste triée |
| `GET` | `/admin/dashboard/recent-payments` | `limit` 1–50 (déf. 10) | liste triée |
| `GET` | `/admin/dashboard/collections` | `from?`, `to?` ISO | `{ totalXof, count, byDay[30j] }` |
| `GET` | `/admin/dashboard/outstanding-balances` | `page`, `limit` 1–100 | `{ items, total, page, limit }` non-annulées |

## 9. Webhooks et intégrations externes

Unique webhook : `POST /api/v1/payments/webhook/paystack` (décrit ci-dessus). Pas de callback backend : `PAYSTACK_CALLBACK_URL` pointe vers le frontend, qui doit appeler `verify`. Signature HMAC-SHA512 de `rawBody` via `x-paystack-signature`, `timingSafeEqual`.

## Routes non implémentées (ne pas coder côté frontend)

Pas de `PUT` nulle part ; pas de `DELETE` étudiants/inscriptions/paiements ; pas de `PATCH` statut étudiant ; pas de modification `email` étudiant ni `slug`/`status` via `PATCH /sprints/:id` ; pas de `callback` backend ; pas de `verify`/`recheck` public sans token ; pas d'export CSV ; pas de refresh/logout JWT ; pas de recherche/tri sur le catalogue public au-delà de `page`/`limit`.

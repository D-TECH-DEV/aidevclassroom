# Inscriptions

Basé sur [enrollments.controller.ts](../../src/enrollments/enrollments.controller.ts) et [enrollments.service.ts](../../src/enrollments/enrollments.service.ts).

## Enums et montants

`EnrollmentStatus` : `PENDING | CONFIRMED | CANCELLED | COMPLETED`. Transitions :

- `PENDING → CONFIRMED, CANCELLED` ; `CONFIRMED → COMPLETED, CANCELLED` ; `CANCELLED, COMPLETED → (aucune)`.
- `COMPLETED` exige un solde soldé (`remainingAmountXof === 0`) sinon `400 ENROLLMENT_NOT_SETTLED`.

Chaque inscription fige `totalAmountXof = priceXof` du sprint au moment de l'inscription. Champs calculés présents sur liste/détail/statut : `totalPaidXof` (somme des `SUCCESS`) et `remainingAmountXof` (`max(0, total − paid)`).

## `POST /api/v1/enrollments` — publique, 20/min

```json
{
  "sprintId": 3,
  "student": { "firstName": "Awa", "lastName": "Diallo", "email": "awa@exemple.com", "phone": "+2250700000000" }
}
```

- Le sprint doit exister et être `ACTIVE`, sinon `404 SPRINT_NOT_FOUND` ou `422 SPRINT_NOT_ACTIVE`.
- Capacité : comptage des non-`CANCELLED` ; plein → `409 SPRINT_CAPACITY_REACHED`.
- Doublon (même étudiant + même sprint) → `409 DUPLICATE_ENROLLMENT` (contrainte unique Prisma rattrapée aussi en `P2002`).

Réponse `201` (seule réponse contenant le token en clair) :

```json
{
  "data": {
    "enrollment": { "id": 45, "status": "PENDING", "totalAmountXof": 50000, "student": {}, "sprint": {} },
    "trackingToken": "9f2c...64-caracteres-hex..."
  },
  "meta": {}
}
```

**Conservez `trackingToken`** : il ne sera plus jamais renvoyé. Sans lui, le participant ne peut ni suivre son dossier ni payer.

## Suivi participant (jeton de suivi)

`GET /api/v1/enrollments/:id/status` — guard `TrackingTokenGuard` (header `x-tracking-token`, query `trackingToken` ou body). Réponse minimale (sans `trackingTokenHash`, sans `studentId`) + `totalPaidXof` + `remainingAmountXof` + sprint résumé + paiements (champs limités : `id, amountXof, currency, reference, status, authorizationUrl, paidAt, createdAt`). Erreurs : `401 TRACKING_TOKEN_REQUIRED / TRACKING_TOKEN_INVALID`, `404 ENROLLMENT_NOT_FOUND`.

## Routes admin (JWT `ADMIN`)

- `GET /api/v1/admin/enrollments?page=1&limit=20&sprintId=3&status=PENDING&search=awa` — `search` sur prénom/nom/e-mail. Chaque item enrichi de `totalPaidXof` / `remainingAmountXof`, sprint résumé, paiements triés récents d'abord.
- `GET /api/v1/admin/enrollments/:id` — détail complet + soldes. `404 ENROLLMENT_NOT_FOUND`.
- `PATCH /api/v1/admin/enrollments/:id/status` — body `{ "status": "CONFIRMED" }`. `400 INVALID_ENROLLMENT_TRANSITION` ou `ENROLLMENT_NOT_SETTLED` (clôture non soldée).
- `GET /api/v1/admin/enrollments/:id/payments` — paiements de l'inscription (`404` si inscription inconnue).

## Ce qui n'existe pas

Pas de `DELETE`, pas de `PUT`, pas de modification du sprint ou de l'étudiant via l'inscription, pas de statut participant modifiable par le participant lui-même.

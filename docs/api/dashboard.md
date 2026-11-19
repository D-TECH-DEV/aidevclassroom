# Tableau de bord (admin)

Basé sur [dashboard.controller.ts](../../src/dashboard/dashboard.controller.ts) et [dashboard.service.ts](../../src/dashboard/dashboard.service.ts). Toutes les routes exigent JWT `ADMIN` (`@Controller('admin/dashboard')`, soit `/api/v1/admin/dashboard/...`).

## `GET /api/v1/admin/dashboard/summary`

Agrégats calculés depuis PostgreSQL (`SUCCESS` uniquement pour les encaissements) :

```json
{
  "data": {
    "totalStudents": 120,
    "activeSprints": 4,
    "totalEnrollments": 200,
    "totalCollectedXof": 1500000,
    "totalOutstandingXof": 8500000,
    "pendingPayments": { "count": 6, "amountXof": 120000 },
    "recentEnrollments": [ { "id": 45, "student": {}, "sprint": {} } ],
    "recentPayments": [ { "id": 77, "enrollment": {} } ]
  },
  "meta": {}
}
```

- `totalEnrollments` exclut les `CANCELLED`. `totalOutstandingXof` = somme des restes (`total − SUCCESS`, plancher 0). `recent*` = 10 derniers.

## `GET /api/v1/admin/dashboard/recent-enrollments?limit=10`

`limit` défaut 10, borné 1–50. Inclut étudiant (`id, firstName, lastName, email`) et sprint (`id, name, slug`), tri `createdAt desc`.

## `GET /api/v1/admin/dashboard/recent-payments?limit=10`

Même borne. Inclut inscription + étudiant + sprint résumés.

## `GET /api/v1/admin/dashboard/collections?from=2026-01-01&to=2026-03-31`

Encaissements `SUCCESS` (filtre `paidAt`, `from`/`to` ISO optionnels) :

```json
{ "data": { "totalXof": 1500000, "count": 42, "byDay": [ { "day": "2026-03-01", "total": 50000, "count": 3 } ] }, "meta": {} }
```

`byDay` : 30 derniers jours groupés (SQL `DATE(paid_at)`), `[]` en cas d'erreur SQL (masquée, voir recommandations dans [endpoints.md](./endpoints.md)).

## `GET /api/v1/admin/dashboard/outstanding-balances?page=1&limit=20`

Inscriptions non-`CANCELLED` avec étudiant, sprint et paiements, tri récent d'abord. Réponse `{ items, total, page, limit }` où `total` = nombre d'inscriptions non annulées (non filtré par solde). Calculez `remainingAmountXof` côté frontend ou réutilisez l'agrégat `summary` pour le total.

## Ce qui n'existe pas

Pas de filtre par sprint sur le dashboard, pas d'export CSV, pas de courbe paramétrable autre que `byDay` 30 jours, pas d'accès participant.

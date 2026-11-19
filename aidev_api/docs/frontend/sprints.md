# Sprints et catalogue

Basé sur [sprints.controller.ts](../../src/sprints/sprints.controller.ts) et [sprints.service.ts](../../src/sprints/sprints.service.ts).

## Enums

`SprintStatus` : `DRAFT | ACTIVE | INACTIVE | COMPLETED`. Transitions autorisées :

- `DRAFT → ACTIVE, INACTIVE` ; `ACTIVE → INACTIVE, COMPLETED` ; `INACTIVE → ACTIVE, DRAFT` ; `COMPLETED → (aucune)`.
- Transition interdite → `400 INVALID_STATUS_TRANSITION`.

## Modèle `Sprint`

| Champ | Type | Règles |
|---|---|---|
| `id` | entier | |
| `name` | string ≤ 150, requis | |
| `slug` | string ≤ 190, unique, requis à la création, **non modifiable ensuite** | |
| `description` | string \| null | facultatif |
| `priceXof` | entier > 0 | prix solo, figé à l'inscription (`totalAmountXof`) |
| `minimumPaymentXof` | entier ≥ 1, `≤ priceXof` sinon `400 MINIMUM_EXCEEDS_PRICE` | |
| `duoPriceXof` | entier > 0 \| null | prix duo (2 places), facultatif ; `null` = pas de forfait duo |
| `duoMinimumPaymentXof` | entier ≥ 1 \| null | `≤ duoPriceXof` sinon `400 DUO_MINIMUM_EXCEEDS_PRICE` ; sans prix duo → `400 DUO_MINIMUM_WITHOUT_PRICE` |
| `startAt` / `endAt` | ISO 8601, `endAt > startAt` sinon `400 INVALID_DATES` | |
| `capacity` | entier ≥ 1 \| null | `null` = places illimitées |
| `status` | enum, défaut `DRAFT` | passe par la route dédiée |
| `createdAt` / `updatedAt` | ISO 8601 | |

## Catalogue public

### `GET /api/v1/sprints?page=1&limit=20` — publique

Renvoie les sprints visibles du site : `ACTIVE` (inscriptions ouvertes) et `INACTIVE` (sessions annoncées en « Bientôt »), triés `createdAt desc`. Ni `DRAFT`, ni `COMPLETED`. Même enveloppe `{ items, total, page, limit }`. À utiliser pour afficher le catalogue.

Chaque item porte le compteur d'inscrits :
- `enrolledCount` : dossiers non annulés dont le total des versements `SUCCESS` atteint le minimum du sprint ;
- `enrolledSeats` : personnes inscrites — un dossier `DUO` qualifié vaut 2 places (même convention que `capacity`).

Seule la jauge du site utilise `enrolledSeats` (`inscrits / quota`).

### `GET /api/v1/sprints/:id` — publique

Fiche uniquement si le sprint est `ACTIVE`, sinon `404 { NOT_FOUND / SPRINT_NOT_FOUND }`. Ne pas s'en servir pour deviner l'existence d'un brouillon. Porte aussi `enrolledCount` / `enrolledSeats`.

### `GET /api/v1/sprints/:id/enrolled-count` — publique

Compteur seul (utile pour rafraîchir la jauge sans recharger le catalogue) : `{ sprintId, enrolledCount, enrolledSeats, capacity }`. `404 SPRINT_NOT_FOUND` si le sprint est inconnu, brouillon ou terminé.

## Routes admin (JWT `ADMIN`)

### `GET /api/v1/admin/sprints?page=1&limit=20&status=ACTIVE`

Tous statuts par défaut ; filtre optionnel `status` (enum). `status` invalide → `400`.

### `POST /api/v1/sprints`

```json
{
  "name": "Sprint React",
  "slug": "sprint-react-2026",
  "description": "4 semaines intensives",
  "priceXof": 50000,
  "minimumPaymentXof": 5000,
  "startAt": "2026-03-01T09:00:00.000Z",
  "endAt": "2026-03-28T18:00:00.000Z",
  "capacity": 60,
  "status": "DRAFT"
}
```

`status` facultatif. Erreurs : `400` validation / `MINIMUM_EXCEEDS_PRICE` / `INVALID_DATES`, `409 SLUG_EXISTS`.

### `GET /api/v1/admin/sprints/:id`

Fiche complète quel que soit le statut (édition dashboard). `404 SPRINT_NOT_FOUND` si inconnu.

### `PATCH /api/v1/sprints/:id`

Champs modifiables : `name, description, priceXof, minimumPaymentXof, duoPriceXof, duoMinimumPaymentXof, startAt, endAt, capacity`. **Ni `slug`, ni `status`** (rejetés par `forbidNonWhitelisted` → `400`). Les inscriptions existantes gardent l'ancien prix. `duoPriceXof: null` retire le forfait duo.

### `PATCH /api/v1/sprints/:id/status`

```json
{ "status": "ACTIVE" }
```

Seule voie de changement de statut. `400 INVALID_STATUS_TRANSITION` sinon.

### `DELETE /api/v1/sprints/:id`

Suppression refusée s'il reste des inscriptions : `409 HAS_ENROLLMENTS`. Sinon fiche supprimée. `404 SPRINT_NOT_FOUND` si inconnu.

## Ce qui n'existe pas

Pas de `PUT`, pas de recherche textuelle ni de tri paramétrable sur le catalogue public, pas de réactivation automatique. Un sprint `COMPLETED` est définitif.

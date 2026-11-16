# Étudiants

Basé sur [students.controller.ts](../../src/students/students.controller.ts) et [students.service.ts](../../src/students/students.service.ts).

## Modèle `Student`

| Champ | Type | Notes |
|---|---|---|
| `id` | entier | auto-incrément |
| `firstName` | string ≤ 100 | trim |
| `lastName` | string ≤ 100 | trim |
| `email` | string ≤ 190, unique | trim + minuscules, recherche insensible à la casse côté frontend à éviter |
| `phone` | string | regex `^\+[1-9]\d{6,17}$`, espaces/tirets retirés (ex. `+2250700000000`) |
| `createdAt` / `updatedAt` | ISO 8601 | |

Pas de suppression, pas d'activation : les opérations existantes sont création (publique), liste, détail, modification partielle (admin) et historique d'inscriptions.

## `POST /api/v1/students` — publique, 20/min

Crée un participant, ou **retrouve l'existant sans erreur** (idempotent, jamais de 409) :

```json
{ "firstName": "Awa", "lastName": "Diallo", "email": "awa@exemple.com", "phone": "+2250700000000" }
```

Réponse `201` :

```json
{ "data": { "student": { "id": 12, "...": "..." }, "created": true }, "meta": {} }
```

- `created: false` + étudiant existant si l'e-mail existe déjà (normalisé). Aucune info sensible n'est révélée au-delà de la fiche.
- Erreurs : `400 BAD_REQUEST` (validation, champ inconnu rejeté), `429`.

## Routes admin (JWT `ADMIN`)

### `GET /api/v1/admin/students?page=1&limit=20&search=awa`

`search` cherche dans `firstName`, `lastName`, `email`, `phone` (`contains`, sensible à la casse côté Postgres). Réponse :

```json
{ "data": { "items": [ { "id": 12, "firstName": "Awa", "...": "..." } ], "total": 1, "page": 1, "limit": 20 }, "meta": {} }
```

- `404` jamais sur liste vide (`items: []`). `id` non numérique → `400`.

### `GET /api/v1/admin/students/:id`

Retourne la fiche. `404 { STUDENT_NOT_FOUND }` si inconnu.

### `PATCH /api/v1/admin/students/:id`

Body partiel (`UpdateStudentDto`, **sans `email`** — l'e-mail n'est pas modifiable) :

```json
{ "firstName": "Awa", "lastName": "Diallo", "phone": "+2250700000000" }
```

Tous champs optionnels. Réponse : fiche mise à jour. `404 STUDENT_NOT_FOUND`, `400` validation.

### `GET /api/v1/admin/students/:id/enrollments`

Historique : inscription(s) de l'étudiant avec sprint et paiements. `404 STUDENT_NOT_FOUND` si l'étudiant n'existe pas.

## Ce qui n'existe pas

Pas de `DELETE /students`, pas de `PUT`, pas de filtre par statut ni de tri paramétrable sur la liste admin, pas de modification d'e-mail. Ne pas coder de bouton « supprimer étudiant ».

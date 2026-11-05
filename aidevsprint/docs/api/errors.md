# Erreurs et conventions HTTP

Basé sur [http-exception.filter.ts](../../src/common/filters/http-exception.filter.ts) et les services.

## Format unique

Succès : `{ "data": T, "meta": {} }`. Listes : `data = { items, total, page, limit }`. Erreur :

```json
{ "statusCode": 404, "code": "SPRINT_NOT_FOUND", "message": "Sprint introuvable." }
```

Pas de `{ success }`, pas de `totalPages`. Les champs sensibles (`password`, `trackingToken`, `providerResponse`...) sont masqués dans les logs, jamais renvoyés (sauf `trackingToken` à la création).

## Tableau des codes réellement renvoyés

| Code | Quand | `code` typiques | Stratégie frontend |
|---|---|---|---|
| `400` | validation DTO, champ inconnu, transition interdite, montant invalide | `BAD_REQUEST`, `INVALID_STATUS_TRANSITION`, `INVALID_ENROLLMENT_TRANSITION`, `PAYMENT_AMOUNT_INVALID`, `BELOW_MINIMUM`, `ENROLLMENT_NOT_SETTLED` | afficher `message`, corriger le formulaire ; ne pas réessayer tel quel |
| `401` | JWT absent/expiré/compte désactivé, login faux, token de suivi absent/invalide | `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `INVALID_CURRENT_PASSWORD`, `TRACKING_TOKEN_REQUIRED`, `TRACKING_TOKEN_INVALID` | login expiré → rediriger vers login ; suivi → redemander le lien/token |
| `403` | JWT valide sans rôle `ADMIN` | `FORBIDDEN` | masquer les écrans admin |
| `404` | ressource inconnue, sprint non-ACTIVE côté public | `NOT_FOUND`, `ADMIN_NOT_FOUND`, `STUDENT_NOT_FOUND`, `SPRINT_NOT_FOUND`, `ENROLLMENT_NOT_FOUND`, `PAYMENT_NOT_FOUND` | écran « introuvable » |
| `409` | conflit métier | `ADMIN_EMAIL_EXISTS`, `DUPLICATE_ENROLLMENT`, `SPRINT_CAPACITY_REACHED`, `HAS_ENROLLMENTS`, `PAYMENT_AMOUNT_EXCEEDS_BALANCE`, `ENROLLMENT_ALREADY_SETTLED`, `REFERENCE_CONFLICT` | informer, proposer une alternative (autre sprint, montant moindre) |
| `422` | règle métier (entité comprise mais refusée) | `SPRINT_NOT_ACTIVE`, `ENROLLMENT_CANCELLED`, `PAYMENT_VERIFICATION_MISMATCH` | ne pas réessayer sans changer l'état |
| `429` | throttle (global 120/min, login 10/min, register/enroll 20/min) | `TOO_MANY_REQUESTS` | attendre + réessayer avec backoff |
| `500` | inattendue | `INTERNAL_ERROR` | message générique + retry ; contacter le support |
| `502` | Paystack `verify` injoignable | `PAYSTACK_VERIFY_FAILED` | réessayer `verify` / `recheck` plus tard |
| `503` | Paystack `initialize` injoignable | `PAYSTACK_UNAVAILABLE` | le `PENDING` reste re-vérifiable |

## Cas particuliers

- `ParseIntPipe` sur `:id` : `id` non numérique → `400`.
- `DELETE /sprints/:id` avec inscriptions → `409 HAS_ENROLLMENTS` (pas de `400`).
- Webhook signature invalide → `400 INVALID_WEBHOOK_SIGNATURE` (pas `401`), via `PaystackWebhookController` qui force son propre format.
- Clôture d'inscription non soldée → `400 ENROLLMENT_NOT_SETTLED` (pas `409`).
- `429` Nest : `{ statusCode: 429, code: "TOO_MANY_REQUESTS", message }` via le filtre (le `code` Throttler est normalisé).

## Codes non utilisés

Pas de `405`/`408`/`410`/`418`/`451` spécifiques, pas de `422` générique de validation (la validation DTO reste `400`), pas de `429` personnalisé au-delà du throttler. Ne codez pas de branches pour des codes que le backend ne renvoie pas.

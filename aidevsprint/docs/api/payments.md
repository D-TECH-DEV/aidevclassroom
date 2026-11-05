# Paiements (Paystack)

Basé sur [payments.controller.ts](../../src/payments/payments.controller.ts), [payments.service.ts](../../src/payments/payments.service.ts), [paystack.service.ts](../../src/payments/paystack.service.ts), [balance.util.ts](../../src/payments/balance.util.ts).

## Principes (à respecter côté frontend)

- Devise par défaut `XOF`, montants **entiers**. Conversion isolée : `XOF` transmis tel quel ; `NGN/GHS/ZAR/KES/USD` × 100 (voir `toProviderAmount`).
- Un versement doit vérifier `minimumPaymentXof ≤ amount ≤ remaining`. Les `PENDING` existants sont réservés : deux initialisations simultanées ne peuvent pas dépasser le solde.
- **Le retour navigateur ne prouve rien.** Seule la vérification serveur (`verify`) ou le webhook font foi.
- `PaymentStatus` : `PENDING | SUCCESS | FAILED | ABANDONED` (`ABANDONED` existe en base mais n'est jamais écrit par le code actuel).

## `POST /api/v1/payments/enrollments/:id/initialize` — jeton de suivi

Guard `TrackingTokenGuard`. Body :

```json
{ "amountXof": 10000 }
```

Déroulement : contrôles → création `PENDING` en transaction → appel Paystack `initialize` (e-mail étudiant, référence `sp_...`, `callbackUrl` = `PAYSTACK_CALLBACK_URL` frontend) → `authorizationUrl` stockée. Le paiement reste `PENDING` si Paystack est injoignable (`503 PAYSTACK_UNAVAILABLE`, à re-vérifier plus tard).

Réponse `201` :

```json
{ "data": { "paymentId": 77, "reference": "sp_...", "status": "PENDING", "authorizationUrl": "https://checkout.paystack.com/..." }, "meta": {} }
```

Erreurs : `400 PAYMENT_AMOUNT_INVALID / BELOW_MINIMUM`, `404 ENROLLMENT_NOT_FOUND`, `409 PAYMENT_AMOUNT_EXCEEDS_BALANCE / ENROLLMENT_ALREADY_SETTLED / PAYMENT_REFERENCE_CONFLICT`, `422 ENROLLMENT_CANCELLED`, `401/404` du guard.

Frontend : redirigez vers `authorizationUrl`. Paystack rappelle votre `callbackUrl` frontend (ex. `/payment/callback?reference=...`), qui doit ensuite appeler `verify`.

## `GET /api/v1/payments/:reference/verify` — JWT admin OU jeton de suivi

Guard `PaymentAccessGuard` : passe si JWT `ADMIN` valide, sinon exige le `x-tracking-token` lié à l'inscription (header ou `?trackingToken=`). Vérification serveur idempotente : si déjà `SUCCESS`, retour immédiat ; sinon appel Paystack `verify`, contrôle **statut + référence + montant + devise**, puis `SUCCESS` (+ `paidAt`, réponse assainie) ou `FAILED` + `422 PAYMENT_VERIFICATION_MISMATCH`. Paystack injoignable → `502 PAYSTACK_VERIFY_FAILED`.

Réponse `200` : paiement enrichi (`totalPaidXof`, `remainingAmountXof` de l'inscription). En cas de mismatch, le `422` inclut le paiement sous `payment` pour traçabilité.

## Webhook `POST /api/v1/payments/webhook/paystack` — serveur à serveur uniquement

Vérifie `x-paystack-signature` = HMAC-SHA512 du **corps brut** (`rawBody`, `rawBody: true`) avec `PAYSTACK_SECRET_KEY`, en `timingSafeEqual`. Succès → `200 { data, meta }`. Échec → `400 { INVALID_WEBHOOK_SIGNATURE | INVALID_WEBHOOK_PAYLOAD, ... }`. Ne jamais appeler depuis le navigateur. Événements `charge.success` : `SUCCESS` si montant/devise/référence concordent.

## Routes admin (JWT `ADMIN`)

- `GET /api/v1/admin/payments?page=1&limit=20&enrollmentId=45&status=SUCCESS&reference=sp_...`
- `GET /api/v1/admin/payments/:id` — `404 PAYMENT_NOT_FOUND` si inconnu.
- `POST /api/v1/admin/payments/:id/recheck` — relance `verify` côté serveur (mêmes effets que `verify`).

## Parcours frontend recommandé

1. `POST /enrollments` → gardez `trackingToken`.
2. `POST /payments/enrollments/:id/initialize` (header `x-tracking-token`) → `authorizationUrl`.
3. Redirection Paystack → retour sur votre `callbackUrl` → lisez `reference`.
4. `GET /payments/:reference/verify` (avec `x-tracking-token`) → statut définitif.
5. En parallèle, le webhook met à jour le statut même si l'usager ferme l'onglet.

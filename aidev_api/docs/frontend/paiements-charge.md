# Paiement direct mobile money (Charge Paystack)

Parcours sans carte ni redirection : MTN, Orange, Wave. L'ancien parcours
(checkout Paystack avec redirection) reste en place en repli.

Basé sur [payments.service.ts](../../src/payments/payments.service.ts),
[paystack.service.ts](../../src/payments/paystack.service.ts),
[payment.dto.ts](../../src/payments/dto/payment.dto.ts),
[payments.controller.ts](../../src/payments/payments.controller.ts),
[env.validation.ts](../../src/config/env.validation.ts) côté back, et
`ParcoursPaiement.tsx`, `ReprendrePaiement.tsx`, `lib/paiement.ts` côté
site (voir `aidevsprint/src/...`).

## Le parcours en 6 étapes (même modale, sans redirection)

E1 — Inscription : inchangée (`FormulaireInscription`). À la confirmation,
le dossier (id, jeton de suivi, montants serveurs) entre dans le parcours.

E2 — Moyen : radios MTN / Orange / Wave, jamais de carte (décision produit :
aucun champ PAN/CVV/PIN n'existe). Montants déterminés automatiquement :
le minimum du dashboard (« Réserver ma place ») et le reste à payer
(« Tout payer ») — ni 30 %, ni étape supplémentaire.
`Précédent` conserve opérateur, montant et téléphone.

E3 — Téléphone : numéro ivoirien strict (`225` + 10 chiffres, sans `+`),
puis `POST /payments/enrollments/:id/initialize`
`{ amountXof, provider, phone }`. Bouton désactivé pendant l'envoi ;
le serveur réutilise une charge PENDING récente identique au lieu de
re-débiter (anti-double-clic, 10 min).

E4 — Consigne : `display_text` du fournisseur (« validez sur votre
téléphone »), compte à rebours 180 s. Le site interroge
`GET /payments/:reference/verify` après 2 s puis toutes les 5 s jusqu'à
la fin de la fenêtre, re-vérifie au retour sur l'onglet (`visibilitychange`
/ `focus`) et sur demande (« Vérifier »). La charge est rangée en
`localStorage` : fermer la modale ne la perd pas, la reprise se fait ici
ou depuis « reprendre mon paiement ».

E5 — États : `pending` / `success` / `failed` affichés dans la même modale,
avec les mêmes messages et la même vérification que `ReprendrePaiement` /
page de retour (`traduitPaiement`, `verifiePaiement`).

E6 — Reçu : solde lu sur le dossier (`statutInscription` : total payé,
reste), jamais déduit côté navigateur.

Repli automatique : si la charge est désactivée côté serveur, l'initiation
rend une `authorizationUrl` et le site redirige comme l'ancien parcours.

## Architecture

```
Site (ParcoursPaiement + lib/paiement.ts)
  │ POST initialize { amountXof, provider, phone }   (jeton x-tracking-token)
  ▼
POST /payments/enrollments/:id/initialize (TrackingTokenGuard)
  │ provider non vide ET PAYSTACK_CHARGE_ENABLED=true → POST /charge Paystack
  │ sinon → transaction/initialize + checkout (ancien flux, RG08)
  ▼
Réservation PENDING (SELECT ... FOR UPDATE, anti-dépassement RG03/RG06)
  │ charge.success → webhook ou GET verify → SUCCESS / FAILED
  ▼
GET /payments/:reference/verify (PaymentAccessGuard : JWT ADMIN ou jeton)
```

Montant 100 % serveur : la réservation PENDING est identique quel que soit
le canal. Aucun secret collecté : seul le numéro transite, jamais de PIN,
OTP ni code, rien de sensible en logs (`sanitizeProviderPayload`, RG10/RG16).
Conversion montants isolée : XOF × 100 vers Paystack (`toProviderAmount`).

La boucle des 180 s vit côté site (`FENETRE_CHARGE_MS`,
`INTERVALLE_VERIF_CHARGE_MS`) : le back expose un `verify` idempotent et
sans état. `PaystackService.pollTransactionVerification` (même fenêtre
côté serveur) est testé mais n'est appelé par aucun flux de production.

## Bascule (flags)

| Flag | Défaut (absent) | Effet |
|---|---|---|
| `PAYSTACK_CHARGE_ENABLED` (back) | `false` = ancien flux | Charge seulement si `true` (`1`/`true`/`yes`) **et** `provider` fourni |
| `NEXT_PUBLIC_PAYSTACK_CHARGE_ENABLED` (site) | actif | `"0"` = ancien écran checkout ; sinon parcours direct. Bascule auto vers le checkout si le back rend `authorizationUrl` |
| `PAYSTACK_CHARGE_PROVIDERS` (back) | `mtn,orange,wave` | CSV des opérateurs autorisés ; toute autre valeur → `400 PAYMENT_PROVIDER_INVALID` |

Règles serveur (`initialize`) : sans `provider` → ancien flux, même si le
flag est actif ; `phone` sans `provider` et flag actif → `400`
`PAYMENT_PROVIDER_INVALID` (un numéro sans opérateur serait ignoré en
silence) ; flag inactif → `provider`/`phone` ignorés, ancien flux tel quel.

Cartes : exclues partout (produit). Le seul statut Paystack lié aux cartes
(`send_otp`) garde la réservation PENDING sans nouveau parcours.

## Statuts

`PaymentStatus` : `PENDING | SUCCESS | FAILED | ABANDONED`.

- `PENDING` : réservation créée, en attente (checkout ouvert **ou** validation
  sur le téléphone : `pay_offline`, `pending`, `send_otp`, statuts
  intermédiaires avec la bonne référence — jamais un échec).
- `SUCCESS` : `verify` a confirmé statut + référence + montant + devise
  (RG09), ou le webhook `charge.success` re-vérifié. Idempotent.
- `FAILED` : `POST /charge` refusé (`422 PAYMENT_CHARGE_FAILED`, aucun débit)
  ou `verify` terminal (`failed`, `abandoned`, montant/devise/référence
  incohérents → `422 PAYMENT_VERIFICATION_MISMATCH`). Court-circuit :
  un `FAILED` récent ne re-interroge pas Paystack
  (`PAYSTACK_FAILED_SHORT_CIRCUIT_MINUTES`, `0` = désactivé).
- `ABANDONED` : voir politique ci-dessous.

Réponses d'initiation (charge) : `{ paymentId, reference, status,
authorizationUrl: null, displayText, chargeStatus }`.

## Webhooks

`POST /payments/webhook/paystack`, serveur à serveur uniquement. Signature
`x-paystack-signature` = HMAC-SHA512 du **corps brut** avec
`PAYSTACK_SECRET_KEY`, comparée en temps constant (`timingSafeEqual`) ;
invalide → `400`, aucune écriture. `charge.success` → recherche par
`reference` ou `providerReference`, puis re-vérification serveur avant toute
écriture (`verify`, idempotent). Tout autre événement → accusé de réception
sans écriture ni appel fournisseur.

## Politique ABANDONED

Un `PENDING` plus ancien que `PAYSTACK_PENDING_RESERVE_MINUTES` (défaut
120 min) passe à `ABANDONED` via `expireStalePendingPayments`, appelée à
chaque `initialize` et chaque `verify` (expiration défensive : un échec du
marquage ne fait jamais échouer la demande). Un `ABANDONED` ne réserve plus
le solde (les PENDING expirés ne bloquent plus les versements suivants) mais
reste re-vérifiable : payé entre-temps, `verify` le passe à `SUCCESS`.

## Matrice opérateurs

| Opérateur | Canal | Sandbox vérifié | Live |
|---|---|---|---|
| MTN (`mtn`) | `POST /charge`, E.164 `225XXXXXXXXXX` | succès (débité, `verify` → `success`) | `pay_offline` + `display_text` → validation sur le téléphone → webhook `charge.success` → `verify` (fenêtre 180 s) |
| Wave (`wave`) | idem | succès | idem |
| Orange (`orange`) | idem | code opérateur valide (réserve : parcours `send_otp` non collecté côté site, la charge reste PENDING et re-vérifiable) | idem |
| Cartes | exclu | — | — (aucun parcours carte ; `send_otp` sans suite côté site) |

## Variables d'environnement

Back (`aidev_api/.env.example`, validées par `env.validation.ts`) :

| Variable | Défaut code | Rôle |
|---|---|---|
| `PAYSTACK_CHARGE_ENABLED` | `false` | `true` = débit direct ; sinon ancien flux |
| `PAYSTACK_CHARGE_PROVIDERS` | `mtn,orange,wave` | opérateurs autorisés (CSV) |
| `PAYSTACK_CHARGE_POLL_TIMEOUT_MS` | `180000` | fenêtre de scrutation d'une charge |
| `PAYSTACK_CHARGE_POLL_INTERVAL_MS` | `5000` | intervalle de scrutation |
| `PAYSTACK_PENDING_RESERVE_MINUTES` | `120` | réservation PENDING avant `ABANDONED` |
| `PAYSTACK_FAILED_SHORT_CIRCUIT_MINUTES` | `15` | `FAILED` récent non re-interrogé (`0` = off) |
| `PAYSTACK_HTTP_TIMEOUT_MS` | `15000` | délai max d'un appel Paystack |

Racine (`.env.dev/preprod/prod.example`, jamais de secret) : mêmes clés
Paystack + `NEXT_PUBLIC_API_URL` et `NEXT_PUBLIC_PAYSTACK_CHARGE_ENABLED`
(`1` = parcours direct, `"0"` = repli ; reconstruire l'image frontend pour
l'appliquer — `ARG` Docker, `compose.*.yml` — les `NEXT_PUBLIC_*` sont
figées au build). Exemples : jamais de clé réelle, préfixe `sk_test_` en
dev/preprod, `sk_live_` en prod.

## Runbook

Cas de re-vérification :

1. Participant bloqué en « en attente » après ses 180 s : page de retour ou
   « reprendre mon paiement » → « Vérifier » (`GET verify` avec le jeton).
   `PENDING` persistant → demander le retour sur le téléphone (validation
   USSD non faite) puis re-vérifier ; `FAILED` → relancer une charge (un
   `422 PAYMENT_CHARGE_FAILED` initial garantit aucun débit).
2. Admin : `POST /admin/payments/:id/recheck` (JWT `ADMIN`) = même effet que
   `verify` (voir [paiements](./payments.md#routes-admin-jwt-admin)). Filtres
   `GET /admin/payments?status=PENDING&reference=sp_...`.
3. Webhook : `charge.success` non reçu (onglet fermé, réseau) → `verify`
   suffit, le webhook n'est qu'un second chemin vers le même `verify`.
   Signature rejetée (`400 INVALID_WEBHOOK_SIGNATURE`) → vérifier
   `PAYSTACK_SECRET_KEY` et le corps brut (proxy sans réécriture).
4. Retour navigateur : ne prouve rien. Seuls `verify` / webhook font foi ;
   `PAYSTACK_CALLBACK_URL` doit pointer sur `/paiement/retour` du site.
5. Bascule d'urgence vers l'ancien flux : back `PAYSTACK_CHARGE_ENABLED`
   à `false` (redéploiement), ou site `NEXT_PUBLIC_PAYSTACK_CHARGE_ENABLED`
   à `"0"` (rebuild). Les charges en cours restent re-vérifiables.

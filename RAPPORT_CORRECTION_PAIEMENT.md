# Rapport — Correction du montant incorrect lors de la réservation et du paiement Paystack

Date : 2026-11-07 — Périmètre : `aidev_api` (NestJS/Prisma) + `aidevsprint` (site Next.js).

## 1. Cause exacte du problème

Trois défauts cumulés, dont un critique :

### Cause A — critique : conversion XOF vers Paystack fausse (facteur 100 manquant)

`toProviderAmount()` / `fromProviderAmount()` (`aidev_api/src/payments/paystack.service.ts`)
envoyaient le XOF **tel quel** à Paystack (hypothèse « le XOF n'a pas de sous-unité,
donc pas de facteur 100 »).

Or la documentation officielle Paystack (API Reference, section « Supported currency »)
est explicite :

> « Sending an amount in subunits simply means multiplying the base amount by **100**.
> While there is no subunit for **XOF**, developers **must** multiply the amount by **100**
> regardless. »

Conséquence : pour un versement de 50 000 XOF, l'API transmettait `amount: 50000`,
que Paystack interprète comme 500,00 XOF. **Le participant était débité 100× moins
que le prix réel**, tandis que la vérification serveur (`fromProviderAmount` symétriquement
fausse) validait quand même le paiement et le marquait `SUCCESS` pour 50 000 XOF.
Résultat : des inscriptions soldées en comptabilité sans l'encaissement réel correspondant.
C'est le « montant débité par Paystack [qui] ne correspond pas au prix réel ».

### Cause B — le site payait le prix du catalogue, pas le total figé de l'inscription

`FormulaireInscription.tsx` (écran de confirmation après réservation) calculait
l'acompte de 30 % et le bouton « Tout payer » à partir de `edition.prixFCFA` /
`edition.minimumFCFA` (prix du catalogue public, revalidé périodiquement), alors que
`POST /enrollments` venait de répondre avec le total figé (`enrollment.totalAmountXof`).
Si le prix du Sprint changeait entre l'affichage du catalogue et la réservation :
montant demandé à Paystack différent du solde réel → soit rejet backend
(`PAYMENT_AMOUNT_EXCEEDS_BALANCE`), soit reliquat impayé involontaire.

### Cause C — concurrence et PENDING bloquants (absence de verrou, réserves sans expiry)

`PaymentsService.initialize()` lisait les paiements puis créait le `PENDING`
dans une transaction **sans verrouiller la ligne d'inscription** (`SELECT ... FOR UPDATE`
manquant) : sous PostgreSQL (`READ COMMITTED`), deux initialisations simultanées
pouvaient lire le même solde et, ensemble, le dépasser.
De plus, tous les `PENDING` — y compris les checkouts abandonnés depuis des jours —
étaient comptés comme « réservés », ce qui rejetait ensuite des versements légitimes
(« Solde insuffisant compte tenu des versements en cours ») alors que rien n'avait
été encaissé.

## 2. Fichiers modifiés

| Fichier | Nature |
|---|---|
| `aidev_api/src/payments/paystack.service.ts` | Correction conversion ×100 (toutes devises, XOF inclus) + garde-fous entiers |
| `aidev_api/src/payments/payments.service.ts` | Verrou `FOR UPDATE` + réserve PENDING à durée limitée dans `initialize` |
| `aidev_api/src/payments/paystack-signature.spec.ts` | Attentes de conversion corrigées + round-trip + rejets invalides |
| `aidev_api/src/payments/payments.service.spec.ts` | 6 nouveaux tests (voir §5) + mock `createdAt`/`$queryRaw` |
| `aidev_api/src/payments/balance.spec.ts` | Scénario séquentiel 10 000 → 15 000 → solde 25 000 |
| `aidev_api/src/enrollments/enrollments.service.spec.ts` | Test prix figé après changement catalogue |
| `aidevsprint/src/components/inscription/FormulaireInscription.tsx` | Boutons/acompte calculés sur le total serveur, plus le catalogue |
| `aidev_api/.env.example` | Nouvelle variable `PAYSTACK_PENDING_RESERVE_MINUTES="120"` |

## 3. Ancienne logique → nouvelle logique

### 3.1 Conversion Paystack

- Avant : `toProviderAmount(10000, 'XOF') === 10000`, `fromProviderAmount(10000, 'XOF') === 10000`
  (identité pour XOF, ×100 seulement pour NGN/GHS/ZAR/KES/USD).
- Après : `toProviderAmount(montantXof) === montantXof * 100` et
  `fromProviderAmount(montantFournisseur) === Math.round(montantFournisseur / 100)`
  **pour toutes les devises**, avec rejet des montants non entiers/négatifs
  (`PAYSTACK_AMOUNT_INVALID`). Le paramètre `currency` est conservé à la signature
  pour traçabilité mais ne branche plus la conversion : la règle Paystack est uniforme.
- La vérification (`applyVerification`) compare désormais le montant Paystack
  **ramené à la bonne échelle** au `amountXof` stocké, plus la devise et la référence :
  tout écart (montant, devise, statut, référence) → `FAILED` + `PAYMENT_VERIFICATION_MISMATCH`,
  sans toucher à l'inscription.

### 3.2 Verrou et réserve PENDING (`initialize`)

- Avant : lecture des paiements + création `PENDING` en transaction, sans verrou ;
  tous les `PENDING` réservaient le solde indéfiniment.
- Après : `SELECT "id" FROM "enrollments" WHERE "id" = $1 FOR UPDATE` en tête de
  transaction (les initialisations concurrentes se sérialisent) ; seuls les `PENDING`
  de moins de `PAYSTACK_PENDING_RESERVE_MINUTES` (défaut : 120) réservent le solde.
  Les `PENDING` expirés restent re-vérifiables (`/verify`, webhook) s'ils ont été
  payés, mais ne bloquent plus les nouveaux versements.

### 3.3 Frontend réservation

- Avant : acompte 30 % et « Tout payer » = `edition.prixFCFA` (catalogue).
- Après : `totalXof = enrollment.totalAmountXof` et
  `minimumXof = enrollment.sprint?.minimumPaymentXof ?? edition.minimumFCFA`
  issus de la réponse `POST /enrollments`. Le catalogue ne sert plus qu'à l'affichage.

## 4. Règles de gestion — conformité vérifiée

1. Prix de référence = `sprints.priceXof` en base. ✔ (inchangé)
2. Prix figé à la réservation (`enrollments.totalAmountXof = sprint.priceXof`). ✔ + nouveau test.
3. Montant payé ≤ solde restant (`validatePaymentAmount` + réserve `FOR UPDATE`). ✔ renforcé.
4. Paiements multiples libres. ✔ (inchangé)
5. Chaque versement libre dans la limite du solde. ✔ (inchangé)
6. `Solde = total − Σ SUCCESS`. ✔ (inchangé, `balance.util.ts` non modifié)
7. Seuls les `SUCCESS` diminuent le solde. ✔ + tests.
8. `FAILED`/`PENDING`/`ABANDONED` jamais comptabilisés comme encaissé. ✔ + tests.
9. Le participant ne modifie jamais le total (DTO `whitelist`, total jamais repris du frontend). ✔
10. Montant Paystack = montant validé backend (`toProviderAmount` sur `amountXof` validé). ✔ corrigé.

Sécurité/webhooks inchangés et toujours valides : signature HMAC-SHA512 sur corps brut
avec comparaison constante, re-vérification serveur avant toute écriture, idempotence
(`SUCCESS` existant → retour sans nouvel appel), redirection navigateur jamais
considérée comme preuve.

## 5. Tests effectués et résultats

Suite unitaire backend : **6 suites, 39 tests, 39 passés**
(`tsc --noEmit` propre, `eslint` propre sur tous les fichiers touchés).

Couverture des 12 cas exigés :

| Cas exigé | Couverture |
|---|---|
| Réservation au prix exact du Sprint | `enrollments.service.spec` « fige le prix » ✔ (pré-existant) |
| Premier paiement partiel | `balance.spec` séquentiel + `payments.service.spec` transmission `providerAmount = 1 000 000` pour 10 000 XOF ✔ |
| Deuxième paiement partiel | `balance.spec` séquentiel (10 000 → 15 000, reste 25 000) ✔ |
| Paiement du solde restant | `initialize(1, 25000)` accepté sur reste 25 000 ✔ |
| Paiement supérieur au solde | `25001 > 25000` → `PAYMENT_AMOUNT_EXCEEDS_BALANCE` (409) ✔ |
| Paiement sous le minimum | `4999 < 5000` → `PAYMENT_AMOUNT_BELOW_MINIMUM` ; bornes `validatePaymentAmount` ✔ (pré-existant + service) |
| Prix du Sprint modifié après réservation | Nouveau test : total figé 50 000 conservé, nouvelle inscription à 60 000 ; `initialize` plafonné au total figé ✔ |
| Deux tentatives simultanées | Réserve `PENDING` ✔ (pré-existant) + nouveau test `SELECT ... FOR UPDATE` émis dans la transaction ✔ |
| Webhook Paystack dupliqué | Nouveau test : double `charge.success` → un seul passage, `verifyTransaction` jamais rappelée, deux réponses `SUCCESS` ✔ |
| Montant Paystack différent | `PAYMENT_VERIFICATION_MISMATCH` → `FAILED` ✔ (pré-existant) |
| Devise incorrecte | Nouveau test : montant exact mais `NGN` au lieu de `XOF` → `FAILED` + mismatch ✔ |
| Paiements échoués et en attente | `balance.spec` exclusions ✔ (pré-existant) + `PENDING` expiré et `FAILED` ignorés par `initialize` ✔ |

Note : l'ancienne attente « XOF sans facteur 100 » du test de conversion encodait le bug
(contredite par la doc officielle Paystack) : elle a été corrigée avec justification,
pas contournée.

Chaîne de vérification exécutée : `prisma generate` → `jest` (6/6 suites, 39/39) →
`eslint` (propre) → `tsc --noEmit` (propre). Le frontend n'a pas de harnais de test
(aucun runner dans `aidevsprint`) : la modification y est minimale (source du montant)
et couverte en invariant côté backend ; vérification manuelle recommandée (réserver
puis comparer l'acompte/total affichés au total figé).

## 6. Migrations nécessaires

**Aucune.** Aucun changement de schéma Prisma : pas de migration, pas de modification
de prix enregistrés, aucun historique de paiement touché, aucun paiement marqué
`SUCCESS` artificiellement. Seule action ops : exposer si besoin
`PAYSTACK_PENDING_RESERVE_MINUTES` (défaut 120 minutes codé en dur sinon).

## 7. Points de vigilance restants (hors correctif, non bloquants)

- Les `Payment` créés avant ce correctif portent un `amountXof` nominal correct en base ;
  en revanche, si des transactions Paystack réelles ont été initialisées avec l'ancien
  facteur, les montants effectivement débités côté Paystack pour ces références sont
  100× inférieurs : à rapprocher avec le dashboard Paystack avant toute relance.
- Sur-paiement résiduel théorique (deux `PENDING` initialisés à des moments éloignés
  puis tous deux payés) : `remainingAmountXof` est plancher à 0 et la vérification
  ne transforme jamais de l'argent réellement débité en `FAILED` ; un éventuel trop-perçu
  relève d'un remboursement manuel, pas d'une écriture automatique.

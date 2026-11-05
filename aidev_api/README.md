# API Sprints de formation

API REST (NestJS + TypeScript + PostgreSQL + Prisma + Paystack + JWT) pour vendre des
**Sprints de formation** avec **versements partiels libres** : le participant
s'inscrit sans payer la totalite, puis paie en plusieurs fois. Mini-dashboard
admin inclus. Cahier des charges : [cahier_des_charges_api_sprints.md](./cahier_des_charges_api_sprints.md).

## Demarrage rapide

```bash
cp .env.example .env        # puis renseignez JWT_SECRET, PAYSTACK_SECRET_KEY, DATABASE_URL
npm install
npm run prisma:generate
npm run prisma:migrate      # cree les tables (dev)
npm run prisma:seed         # admin + sprints de demo (ou npm run admin:create)
npm run start:dev           # http://localhost:3000/api/v1/health
```

Swagger : `http://localhost:3000/api/docs`.

Avec Docker (API + PostgreSQL local) :

```bash
cp .env.example .env
docker compose up --build
```

Production (PostgreSQL existant du VPS, sans service DB dédié) :
`docker-compose.prod.yml` + procédure complète dans
[docs/prod-deploy.md](./docs/prod-deploy.md) — diagnostic, base/utilisateur
dédiés, sauvegarde, déploiement contrôlé, rollback, reverse proxy.

## Commandes

| Commande | Effet |
|---|---|
| `npm run start:dev` | API en watch mode |
| `npm run build` / `npm run start:prod` | build puis prod (`node dist/main`) |
| `npm run lint` | ESLint |
| `npm test` | 28 tests unitaires (soldes, Paystack, inscriptions, sprints) |
| `npm run test:e2e` | 4 tests e2e (health, 401 admin, webhook, validation) |
| `npm run prisma:generate` | regenere le client Prisma |
| `npm run prisma:migrate` | migration dev versionnee |
| `npm run prisma:migrate:deploy` | applique les migrations (prod) |
| `npm run prisma:seed` | admin + sprints de demo (`npx prisma db seed` equivalent, charge `.env`) |
| `npm run admin:create -- email Nom MotDePasse` | premier admin (mot de passe hache bcrypt) |

## Hypothese Paystack documentee (XOF)

La conversion est isolee dans `PaystackService.toProviderAmount` :
**XOF transmis tel quel** (aucun facteur 100 arbitraire), devises a
sous-unites (NGN/GHS/ZAR/KES/USD) x100. Verifiez que la devise et les canaux
sont bien actives sur votre compte Paystack et adaptez `PAYSTACK_CURRENCY` /
`PAYSTACK_CALLBACK_URL`. La cle secrete ne sort jamais du serveur.

## Regles metier (resume)

- Montants entiers XOF ; versement `>= minimum` du Sprint et `<= solde restant`,
  solde calcule serveur (`total - somme(SUCCESS)`).
- Prix fige a l'inscription ; inscriptions uniquement sur Sprint `ACTIVE`,
  capacite protegee en transaction, doublon `(student, sprint)` refuse (409).
- Jeton de suivi : rendu **une seule fois** a la creation, stocke en hash
  SHA-256 ; routes participant via header `x-tracking-token`.
- Paiement : tentative locale `PENDING` + reference imprevisible, URL renvoyee
  **par Paystack uniquement** ; confirmation seulement apres verification
  serveur (statut, reference, montant, devise). Webhook HMAC-SHA512 sur corps
  brut + re-verification ; idempotence garantie. `FAILED` ne touche jamais
  l'inscription ; `COMPLETED` exige un solde nul ; `CANCELLED` garde l'historique.

## Routes principales (`/api/v1`)

Auth admin : `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`.
Admins : `GET|POST /admins`, `GET|PATCH /admins/:id`, `PATCH /admins/:id/disable`.
Sprints : `GET /sprints`, `GET /sprints/:id` (publics, actifs) ;
`GET /admin/sprints`, `POST /sprints`, `PATCH /sprints/:id`,
`PATCH /sprints/:id/status`, `DELETE /sprints/:id` (admin, 409 si inscriptions).
Participants : `POST /students` (public) ; `GET /admin/students`,
`GET|PATCH /admin/students/:id`, `GET /admin/students/:id/enrollments` (admin).
Inscriptions : `POST /enrollments` (public, corps `{sprintId, student:{...}}`) ;
`GET /enrollments/:id/status` (jeton) ; `GET /admin/enrollments`,
`GET /admin/enrollments/:id`, `PATCH /admin/enrollments/:id/status`,
`GET /admin/enrollments/:id/payments` (admin).
Paiements : `POST /payments/enrollments/:id/initialize` (jeton, `{amountXof}`) ;
`GET /payments/:reference/verify` (jeton ou admin) ;
`POST /payments/webhook/paystack` (signature) ; `GET /admin/payments`,
`GET /admin/payments/:id`, `POST /admin/payments/:id/recheck` (admin).
Dashboard : `GET /admin/dashboard/summary|recent-enrollments|recent-payments|collections|outstanding-balances`.
Sante : `GET /health`.

Succes : `{ "data": ..., "meta": {} }`. Erreurs :
`{ "statusCode", "code", "message" }` (ex. `PAYMENT_AMOUNT_EXCEEDS_BALANCE`).

## Documentation frontend

Guide d'intégration complet (contrat vérifié depuis le code) : [docs/frontend/README.md](./docs/frontend/README.md) — authentification, inventaire des 38 endpoints, étudiants, sprints, inscriptions, paiements Paystack, dashboard, erreurs, exemples TS/JS, [OpenAPI](./docs/frontend/openapi.json).

## Tests

- `npm test` : 6 suites, 28 tests — soldes/multi-paiements, exclusion des
  PENDING, montants invalides/sous-minimum/sur-solde, prix fige, Sprint inactif,
  double inscription, capacite, transitions, init Paystack moquee, reservation
  anti-depassement concurrent, idempotence, mismatch montant/devise, webhook
  invalide sans ecriture, signature valide/invalide, conversion XOF.
- `npm run test:e2e` : health 200, admin 401 sans JWT, webhook 400 sans
  signature, inscription invalide 400. Paystack toujours moque, jamais de vrai
  paiement.

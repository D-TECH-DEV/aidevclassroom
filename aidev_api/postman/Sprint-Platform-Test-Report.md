# Rapport de test — Collection Postman Sprint Platform API

Date de génération : 22 octobre 2026. Source auditée : `src/` (contrôleurs,
DTO, guards, services), `prisma/schema.prisma`, `src/main.ts` (préfixe
`api/v1`, docs `/api/docs`, enveloppe `{data, meta}`, erreurs
`{statusCode, code, message}`).

## Couverture des routes (toutes issues du code réel)

| Route | Dossier | Statut |
|---|---|---|
| `GET /health` | 00 | ✅ testé |
| `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password` | 01, 10 | ✅ testés |
| `GET/POST /admins`, `GET/PATCH /admins/:id`, `PATCH /admins/:id/disable` | 02, 10 | ✅ testés |
| `GET /sprints`, `GET /sprints/:id`, `GET /admin/sprints`, `POST/PATCH/DELETE /sprints…`, `PATCH /sprints/:id/status` | 03, 09, 10 | ✅ testés (DELETE 409 ; DELETE sans inscriptions non testé — destructif) |
| `POST /students`, `GET/PATCH /admin/students…`, `GET /admin/students/:id/enrollments` | 04, 10 | ✅ testés |
| `POST /enrollments`, `GET /enrollments/:id/status` (jeton), `GET /admin/enrollments…`, `PATCH /admin/enrollments/:id/status`, `GET …/payments` | 05, 09 | ✅ testés |
| `POST /payments/enrollments/:id/initialize`, `GET /payments/:reference/verify`, `GET /admin/payments…`, `POST /admin/payments/:id/recheck` | 06, 10 | ⚠️ partiel (voir Paystack) |
| `POST /payments/webhook/paystack` | 07, 11 | ⚠️ partiel (voir Paystack) |
| `GET /admin/dashboard/summary|recent-enrollments|recent-payments|collections|outstanding-balances` | 08, 11 | ✅ testés |

Aucune route du cahier des charges ne manque dans le code ; aucune requête
fictive n'a été créée. Point d'attention : il n'existe pas de `GET
/admin/sprints/:id` (détail admin) — le test « ID inexistant » le documente
(404 Nest propre).

## Scénarios

- **Positifs** : santé, login, CRUD complet, inscription, prix figé, statuts et
  transitions valides, soldes cohérents, dashboard, historique.
- **Négatifs** : 401 (sans/faux jeton, jeton suivi absent/faux), 400
  (validation, whitelist, montants, minimum> prix, transitions), 404, 409
  (double inscription, suppression protégée), 422 (sprint inactif, inscription
  annulée), 503/502 Paystack documentés.
- **Sécurité** : hashes/secrets absents des réponses, pas de stack trace,
  injection SQL sans erreur, pagination plafonnée à 100.

## Tests réellement exécutés ici

- `npx jest` : **6 suites, 28 tests — tous passent** (soldes, Paystack mocké,
  inscriptions, sprints).
- `npm run test:e2e` : **4/4 passent** (health, 401 admin, webhook sans
  signature, validation).
- `npm run build` : **OK**. `npx eslint src test` : **propre**.
- Validation JSON des 2 fichiers Postman : **OK** (12 dossiers, 94 requêtes ;
  30 variables toutes résolues).
- **Collection Postman/Newman : préparée mais NON exécutée** — aucun
  environnement live (MySQL + API + clés Paystack test) disponible lors de la
  génération, et aucun paiement réel n'a eu lieu. Ne pas marquer ces tests
  comme réussis avant un run.
- Newman : **non installé** (`command -v newman` à vérifier sur votre poste ;
  commandes dans `README-Postman.md`).

## Limites connues et Paystack

- Sans clés test : init → `503`, verify/recheck → `502`, webhook signé →
  `502` après signature OK. Les scripts acceptent ces codes et le signalent ;
  le parcours « succès » (soldé → COMPLETED, idempotence répétée) exige des
  clés `sk_test_…` et le réseau : **non testé ici, non prétendu**.
- Webhook valide de bout en bout : exige `paystackWebhookSecret` local +
  Paystack joignable (re-vérification serveur obligatoire avant écriture).
- Concurrence réelle au-delà du solde : couverte en unitaire (réservation
  PENDING) ; non rejouée en charge ici.
- Données préexistantes : les assertions dashboard sont en `>=`, jamais en
  égalité stricte.

## Défauts détectés

Aucun défaut bloquant relevé pendant l'audit statique. Rappel : l'hypothèse
de conversion XOF (montant transmis tel quel, sans ×100) est documentée dans
le code et le README — à valider contre la réponse Paystack réelle de votre
compte lors du premier run avec clés test.

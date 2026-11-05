# Guide Postman — Sprint Platform API

## Import

1. Postman → **Import** → sélectionner dans `postman/` :
   - `Sprint-Platform-API.postman_collection.json`
   - `Sprint-Platform-Local.postman_environment.json`
2. En bas à droite, activer l'environnement **Sprint Platform Local**.
3. Renseigner `adminEmail` / `adminPassword` (compte créé via `npm run admin:create`).
   Mot de passe de démonstration par défaut : demandez-le à votre administrateur
   local, il n'est pas versionné avec de vrais secrets.

## Prérequis d'exécution

- API démarrée : `npm run start:dev` (ou `docker compose up`), MySQL joignable,
  migrations appliquées (`npm run prisma:migrate`), compte admin créé.
- Exécuter les dossiers **dans l'ordre** (00 → 11) via le Collection Runner :
  chaque dossier pose les variables utilisées par les suivants
  (`accessToken`, `sprintId`, `enrollmentId`, `trackingToken`, …).
- La collection est **rejouable** : emails et slugs uniques générés en
  pre-request (`Date.now()`), aucune dépendance à des identifiants fixes.

## Paystack (mode test uniquement)

- Sans clés test ni réseau : les requêtes d'initialisation/vérification
  répondent `503 PAYSTACK_UNAVAILABLE` / `502 PAYSTACK_VERIFY_FAILED`.
  Les scripts l'acceptent, positionnent `paystackBlocked=true` et poursuivent :
  **aucun paiement réel n'est effectué ni simulé comme réussi.**
- Avec clés test (`PAYSTACK_SECRET_KEY=sk_test_…` côté API) : les mêmes requêtes
  exercent le vrai parcours (URL d'autorisation renvoyée par Paystack,
  vérification serveur, webhooks).
- Webhook signé : renseigner **en local uniquement** la variable
  d'environnement `paystackWebhookSecret` (type `secret`, jamais commitée).
  La requête « Webhook signe » calcule `HMAC-SHA512(corps exact)` via CryptoJS
  en pre-request. Exigence : le corps envoyé doit être **byte-identique** au
  corps signé — Postman envoie le brut tel quel ; ne pas reformater le JSON
  (pas d'espaces ajoutés). Ne jamais journaliser la clé
  (`console.log` banni pour cette variable).

## Collection Runner

- Runner → Collection **Sprint Platform API** → Environnement **Local** →
  **Run**. Aucun fichier de données externe requis.
- Les assertions critiques (santé, login, protections 401/400/409/422)
  échouent franchement ; les étapes dépendant de Paystack sont conditionnelles
  et expliquent dans la console ce qui manque.

## Newman (CLI)

```bash
npm install -g newman
newman run postman/Sprint-Platform-API.postman_collection.json \
  -e postman/Sprint-Platform-Local.postman_environment.json \
  --env-var adminEmail=<email-dev> --env-var adminPassword=<mot-de-passe-dev>
```

Newman n'est pas installé dans cet environnement de génération : la collection
n'a donc pas été exécutée ici via Newman (voir rapport de test).

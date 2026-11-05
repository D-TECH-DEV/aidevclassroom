# Cahier des charges --- API de gestion des Sprints de formation

**Version :** 1.0 --- **Date :** 22 octobre 2026\
**Destinataire :** Muse Code\
**Stack obligatoire :** NestJS, TypeScript, MySQL, Prisma ORM, Paystack,
JWT.

## 1. Objectif

Concevoir et implémenter une API REST complète pour une plateforme qui
commercialise des Sprints de formation. Les participants peuvent
s'inscrire et payer en plusieurs versements libres, sans devoir payer la
totalité immédiatement. Les organisateurs disposent d'un mini-dashboard
administratif pour gérer les Sprints, participants, inscriptions,
paiements et soldes.

Le livrable doit être un projet exécutable, pas seulement un exemple ou
un squelette. Le frontend complet est hors périmètre : fournir les
routes documentées pour permettre son développement.

## 2. Décisions de conception

-   NestJS + TypeScript.
-   MySQL avec Prisma ORM et migrations versionnées.
-   JWT pour les administrateurs.
-   Paystack pour les paiements.
-   `users` désigne uniquement les administrateurs.
-   `students` désigne les participants.
-   `trainings` est remplacé par `sprints`.
-   `enrollments` conserve les inscriptions.
-   `payments` conserve chaque tentative et versement.
-   Devise métier par défaut : XOF/FCFA. Vérifier que la devise et les
    canaux sont disponibles sur le compte Paystack.
-   Les participants n'ont pas de compte avec mot de passe dans la V1 :
    ils saisissent leurs coordonnées lors de l'inscription. Leurs routes
    de consultation doivent néanmoins être protégées par un jeton de
    suivi aléatoire non devinable.
-   Utiliser des entiers pour les montants FCFA, jamais des flottants.
    Ne pas appliquer arbitrairement un facteur 100 au XOF : isoler la
    conversion fournisseur dans `PaystackService` et respecter les
    unités officiellement attendues par Paystack pour la devise activée.
-   Ne jamais committer les secrets.

## 3. Fonctionnalités incluses

1.  Authentification admin et gestion sécurisée des administrateurs.
2.  CRUD des Sprints.
3.  Enregistrement, consultation et mise à jour des participants.
4.  Création et suivi des inscriptions.
5.  Paiements partiels libres, plafonnés au solde restant.
6.  Initialisation Paystack, vérification serveur, webhook signé et
    idempotence.
7.  Historique des paiements et calcul des soldes.
8.  Mini-dashboard administratif.
9.  DTO, validation, gestion uniforme des erreurs, Swagger, logs sûrs.
10. Migrations et tests unitaires/intégration.

Hors périmètre V1 : frontend complet, cours/quiz/certificats, SMS,
comptabilité avancée, remboursements automatiques, paiements vers les
participants.

## 4. Structure modulaire souhaitée

``` text
src/
  main.ts
  app.module.ts
  config/
  prisma/
    prisma.module.ts
    prisma.service.ts
  common/
    guards/
    decorators/
    filters/
    interceptors/
  auth/
  admins/
  students/
  sprints/
  enrollments/
  payments/
    paystack.service.ts
    paystack-webhook.controller.ts
  dashboard/
  health/
prisma/
  schema.prisma
  migrations/
test/
```

Créer un seul `PrismaService`, exporté par `PrismaModule` et importé
explicitement par les modules qui en ont besoin. Garder les contrôleurs
minces et placer les règles métier dans les services.

## 5. Modèle de données

### `users` --- administrateurs

-   `id` (PK), `name`, `email` (unique), `passwordHash`, `role` (V1 :
    `ADMIN`), `isActive`, `createdAt`, `updatedAt`.
-   Ne jamais retourner `passwordHash`.
-   Créer le premier administrateur via une commande CLI/seed sécurisé
    qui hache le mot de passe. Pas de compte de production avec mot de
    passe codé en dur.

### `students` --- participants

-   `id` (PK), `firstName`, `lastName`, `email`, `phone`, `createdAt`,
    `updatedAt`.
-   Normaliser les e-mails, conserver le téléphone comme chaîne avec
    préfixe international. Indexer e-mail et téléphone. La V1 peut
    imposer un e-mail unique pour limiter les doublons.

### `sprints` --- formations

-   `id` (PK), `name`, `slug` (unique), `description` nullable,
    `priceXof` entier positif, `minimumPaymentXof` entier positif,
    `startAt`, `endAt`, `capacity` nullable, `status` (`DRAFT`,
    `ACTIVE`, `INACTIVE`, `COMPLETED`), `createdAt`, `updatedAt`.
-   Le minimum de versement ne peut pas dépasser le prix.
-   Seuls les Sprints `ACTIVE` acceptent de nouvelles inscriptions.
-   Ne pas supprimer physiquement un Sprint avec des inscriptions ; le
    désactiver ou le terminer.

### `enrollments` --- inscriptions

-   `id` (PK), `studentId` (FK), `sprintId` (FK), `totalAmountXof` (prix
    figé au moment de l'inscription), `status` (`PENDING`, `CONFIRMED`,
    `CANCELLED`, `COMPLETED`), `trackingTokenHash` ou mécanisme
    équivalent sécurisé, `createdAt`, `updatedAt`.
-   Contrainte unique `(studentId, sprintId)` pour éviter les doubles
    inscriptions.
-   Le prix d'une inscription ne change pas si le prix du Sprint change
    ensuite.
-   Les données liées à un historique financier ne sont pas supprimées
    en cascade.

### `payments` --- versements/tentatives

-   `id` (PK), `enrollmentId` (FK), `amountXof` entier strictement
    positif, `currency` (`XOF` par défaut), `reference` unique interne,
    `providerReference` nullable, `status` (`PENDING`, `SUCCESS`,
    `FAILED`, `ABANDONED`), `authorizationUrl` nullable, `paidAt`
    nullable, `providerResponse` JSON nullable et expurgé, `createdAt`,
    `updatedAt`.
-   Indexer `enrollmentId`, `status`, `createdAt`, `providerReference`.
-   Toute référence de paiement doit être unique. Les webhooks et
    vérifications répétés doivent être idempotents.

### Relations

-   Un participant a plusieurs inscriptions.
-   Un Sprint a plusieurs inscriptions.
-   Une inscription appartient à un participant et un Sprint.
-   Une inscription a plusieurs paiements.
-   Les administrateurs gèrent les données mais ne sont pas
    propriétaires des paiements.

## 6. Règles de gestion impératives

**RG01 --- Inscription :** le participant fournit prénom, nom, e-mail et
téléphone pour s'inscrire à un Sprint actif. Valider et normaliser les
données.

**RG02 --- Paiement partiel :** le participant n'est pas obligé de payer
la totalité à l'inscription.

**RG03 --- Montant libre encadré :** un versement est un entier positif
en XOF, supérieur ou égal au minimum défini pour le Sprint, et inférieur
ou égal au solde restant. Le serveur calcule le solde ; il ne fait
jamais confiance au montant total ou au solde fourni par le client.

**RG04 --- Prix figé :** `totalAmountXof` est copié depuis le Sprint au
moment de l'inscription.

**RG05 --- Total payé :** somme des paiements `SUCCESS` uniquement. Les
paiements `PENDING`, `FAILED` ou `ABANDONED` ne sont jamais comptés
comme encaissés.

**RG06 --- Solde :**
`remainingAmountXof = totalAmountXof - somme(SUCCESS)`. Le solde ne peut
pas être négatif. Prévenir les paiements concurrents qui dépasseraient
le solde avec transaction DB et verrouillage/réservation appropriés.

**RG07 --- États séparés :** l'état d'inscription et l'état de paiement
sont différents. Un paiement échoué ne doit pas annuler l'inscription.
Documenter les transitions permises. Ne pas mélanger « solde réglé » et
« sprint terminé » dans un même statut sans règle claire.

**RG08 --- Initialisation Paystack :** créer une tentative locale
`PENDING` avec une référence imprévisible, appeler Paystack côté
serveur, envoyer e-mail, montant converti correctement, devise,
référence et callback URL, puis renvoyer l'URL d'autorisation. L'URL
doit venir de Paystack, jamais être inventée.

**RG09 --- Vérification serveur :** le retour navigateur ne prouve
jamais qu'un paiement est réussi. Vérifier la transaction auprès de
Paystack et contrôler le statut `success`, la référence, le montant et
la devise avant de passer localement à `SUCCESS`.

**RG10 --- Webhook :** route dédiée publique mais authentifiée par
signature. Vérifier HMAC-SHA512 à partir du corps brut exact, comparer
en temps constant, puis re-vérifier la transaction auprès de Paystack
avant confirmation. Une notification invalide ne doit modifier aucune
donnée financière.

**RG11 --- Idempotence :** un événement ou une vérification répétés ne
comptabilisent jamais deux fois le paiement. Les changements d'état sont
atomiques.

**RG12 --- Paiements en attente :** ne pas considérer une tentative en
attente comme encaissée. Permettre la re-vérification serveur et ne pas
marquer arbitrairement un paiement échoué seulement parce que le
navigateur a expiré.

**RG13 --- Annulation :** seul un admin authentifié peut annuler une
inscription. Conserver l'historique ; aucune suppression en cascade de
paiements et aucun remboursement automatique dans la V1.

**RG14 --- Capacité :** si le Sprint possède une capacité, empêcher les
inscriptions concurrentes au-delà de cette capacité.

**RG15 --- Dashboard :** les encaissements comptent uniquement les
paiements `SUCCESS`. Les soldes à recouvrer sont calculés sur les
inscriptions non annulées. Afficher les paiements en attente séparément.

**RG16 --- Protection des données :** une route publique de consultation
ne doit pas exposer les données d'une inscription par simple identifiant
séquentiel ; exiger un jeton de suivi aléatoire et vérifier son hash.

## 7. API REST requise

Préfixe global : `/api/v1`. Utiliser JSON, pagination, filtres et codes
HTTP standard. Les routes admin nécessitent JWT + rôle `ADMIN`.

### Santé et docs

  Méthode   Route              Accès          Action
  --------- ------------------ -------------- -----------------
  GET       `/api/v1/health`   Public         Santé de l'API
  GET       `/api/docs`        Configurable   Swagger/OpenAPI

### Authentification admin

  --------------------------------------------------------------------------------------
  Méthode           Route                            Accès             Action
  ----------------- -------------------------------- ----------------- -----------------
  POST              `/api/v1/auth/login`             Public            Connexion et JWT

  GET               `/api/v1/auth/me`                Admin             Profil connecté

  POST              `/api/v1/auth/change-password`   Admin             Changer le mot de
                                                                       passe
  --------------------------------------------------------------------------------------

Ne pas créer d'endpoint public d'inscription admin. Prévoir une commande
sécurisée de création du premier compte et limiter les tentatives de
connexion.

### Administrateurs

  Méthode   Route                          Accès            Action
  --------- ------------------------------ ---------------- ----------------
  GET       `/api/v1/admins`               Admin            Lister
  GET       `/api/v1/admins/:id`           Admin            Détail
  POST      `/api/v1/admins`               Admin autorisé   Créer un admin
  PATCH     `/api/v1/admins/:id`           Admin            Modifier
  PATCH     `/api/v1/admins/:id/disable`   Admin autorisé   Désactiver

### Sprints

  ------------------------------------------------------------------------------------
  Méthode           Route                          Accès             Action
  ----------------- ------------------------------ ----------------- -----------------
  GET               `/api/v1/sprints`              Public            Lister les actifs
                                                                     avec pagination

  GET               `/api/v1/sprints/:id`          Public            Détail d'un
                                                                     Sprint actif

  GET               `/api/v1/admin/sprints`        Admin             Tous les Sprints,
                                                                     même inactifs

  POST              `/api/v1/sprints`              Admin             Créer

  PATCH             `/api/v1/sprints/:id`          Admin             Modifier

  PATCH             `/api/v1/sprints/:id/status`   Admin             Changer le statut

  DELETE            `/api/v1/sprints/:id`          Admin             Supprimer
                                                                     seulement sans
                                                                     dépendances,
                                                                     sinon `409`
  ------------------------------------------------------------------------------------

### Participants

  ------------------------------------------------------------------------------------------------
  Méthode           Route                                      Accès             Action
  ----------------- ------------------------------------------ ----------------- -----------------
  POST              `/api/v1/students`                         Public            Créer/retrouver
                                                                                 selon règle de
                                                                                 dédoublonnage

  GET               `/api/v1/admin/students`                   Admin             Lister,
                                                                                 rechercher,
                                                                                 paginer

  GET               `/api/v1/admin/students/:id`               Admin             Détail

  PATCH             `/api/v1/admin/students/:id`               Admin             Modifier

  GET               `/api/v1/admin/students/:id/enrollments`   Admin             Historique
  ------------------------------------------------------------------------------------------------

Ne pas révéler publiquement si un e-mail existe. Une requête publique ne
doit pas pouvoir modifier les coordonnées d'un autre participant sans
preuve de contrôle.

### Inscriptions

  --------------------------------------------------------------------------------------------------
  Méthode           Route                                      Accès             Action
  ----------------- ------------------------------------------ ----------------- -------------------
  POST              `/api/v1/enrollments`                      Public            Créer une
                                                                                 inscription

  GET               `/api/v1/admin/enrollments`                Admin             Lister et filtrer

  GET               `/api/v1/admin/enrollments/:id`            Admin             Détail complet

  GET               `/api/v1/enrollments/:id/status`           Jeton de suivi    Résumé minimal et
                                                               requis            solde

  PATCH             `/api/v1/admin/enrollments/:id/status`     Admin             Confirmer/annuler
                                                                                 selon règles

  GET               `/api/v1/admin/enrollments/:id/payments`   Admin             Historique des
                                                                                 versements
  --------------------------------------------------------------------------------------------------

Exemple de création :

``` json
{
  "sprintId": 1,
  "student": {
    "firstName": "Aminata",
    "lastName": "Kone",
    "email": "aminata@example.com",
    "phone": "+2250700000000"
  }
}
```

Le serveur récupère le prix du Sprint. Le client ne peut pas imposer
`totalAmountXof` ni un statut.

### Paiements

  -----------------------------------------------------------------------------------------------------
  Méthode           Route                                           Accès             Action
  ----------------- ----------------------------------------------- ----------------- -----------------
  POST              `/api/v1/payments/enrollments/:id/initialize`   Jeton de suivi    Initier un
                                                                    requis            versement

  GET               `/api/v1/payments/:reference/verify`            Accès sécurisé    Vérifier côté
                                                                    requis            serveur

  POST              `/api/v1/payments/webhook/paystack`             Public +          Webhook
                                                                    signature         
                                                                    obligatoire       

  GET               `/api/v1/admin/payments`                        Admin             Lister/filtrer

  GET               `/api/v1/admin/payments/:id`                    Admin             Détail

  POST              `/api/v1/admin/payments/:id/recheck`            Admin             Re-vérifier
                                                                                      auprès de
                                                                                      Paystack
  -----------------------------------------------------------------------------------------------------

Exemple de requête :

``` json
{ "amountXof": 10000 }
```

Exemple de réponse indicative :

``` json
{
  "paymentId": 123,
  "reference": "sp_reference_unique",
  "status": "PENDING",
  "authorizationUrl": "https://checkout.paystack.com/..."
}
```

L'URL est renvoyée par Paystack. Le service vérifie l'inscription, son
état, le minimum et le solde avant d'initialiser.

### Mini-dashboard

  ------------------------------------------------------------------------------------------------------
  Méthode           Route                                            Accès             Action
  ----------------- ------------------------------------------------ ----------------- -----------------
  GET               `/api/v1/admin/dashboard/summary`                Admin             KPI principaux

  GET               `/api/v1/admin/dashboard/recent-enrollments`     Admin             Dernières
                                                                                       inscriptions

  GET               `/api/v1/admin/dashboard/recent-payments`        Admin             Derniers
                                                                                       paiements

  GET               `/api/v1/admin/dashboard/collections`            Admin             Encaissements par
                                                                                       période

  GET               `/api/v1/admin/dashboard/outstanding-balances`   Admin             Soldes à
                                                                                       recouvrer
  ------------------------------------------------------------------------------------------------------

KPI minimums : total participants, inscriptions non annulées, Sprints
actifs, encaissements confirmés, soldes restants, nombre/montant des
paiements en attente, dernières inscriptions et derniers paiements. Tous
les chiffres doivent venir de MySQL, jamais de valeurs fictives.

## 8. Validation, réponses et erreurs

Activer globalement :

``` typescript
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
```

Utiliser DTO pour chaque écriture. Valider e-mails, longueurs,
téléphone, entiers positifs, enum, dates, pagination et filtres. Le
client ne peut jamais transmettre `status: SUCCESS`, `paidAt`,
`providerResponse`, `passwordHash`, `totalPaidXof` ou
`remainingAmountXof`.

Format de succès :

``` json
{ "data": { "id": 12, "status": "PENDING" }, "meta": {} }
```

Format d'erreur :

``` json
{
  "statusCode": 400,
  "code": "PAYMENT_AMOUNT_EXCEEDS_BALANCE",
  "message": "Le montant dépasse le solde restant."
}
```

Codes : `200`, `201`, `400`, `401`, `403`, `404`, `409`, `422` si retenu
uniformément, `429`, `502`/`503`. Ne jamais renvoyer stack trace,
secrets, hash ou réponse fournisseur sensible.

## 9. Sécurité

-   Hash de mot de passe Argon2id ou bcrypt correctement configuré.
-   JWT signé avec secret fort et expiration raisonnable.
-   Guards JWT et rôle pour toutes les routes d'administration.
-   CORS limité aux origines frontend autorisées ; HTTPS en production.
-   Rate limiting sur login, inscription et routes publiques sensibles.
-   Aucun stockage de données de carte bancaire.
-   Signature webhook calculée sur le corps brut exact avec HMAC-SHA512
    et comparaison en temps constant.
-   Vérification serveur de la transaction, du montant, de la devise, de
    la référence et du statut.
-   Mises à jour atomiques et idempotentes.
-   Secrets et données personnelles masqués dans les logs.
-   Validation des variables d'environnement au démarrage.
-   Requêtes via Prisma et pagination plafonnée.
-   Aucun prix, solde ou statut de transaction accepté comme autorité
    depuis le frontend.
-   Ne pas supprimer les données financières liées à des paiements.

## 10. Configuration d'environnement

Fournir `.env.example`, sans vraies clés :

``` dotenv
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/sprint_platform"
JWT_SECRET="replace_with_a_long_random_secret"
JWT_EXPIRES_IN="1h"
PAYSTACK_SECRET_KEY="sk_test_replace_me"
PAYSTACK_BASE_URL="https://api.paystack.co"
PAYSTACK_CALLBACK_URL="http://localhost:5173/payment/callback"
PAYSTACK_CURRENCY="XOF"
FRONTEND_URL="http://localhost:5173"
```

Adapter le callback au frontend réel. La clé Paystack ne doit jamais
être exposée dans le frontend. Valider toutes les variables au
démarrage. Vérifier les exigences Paystack en vigueur pour XOF et ses
unités.

## 11. Fichiers et commandes attendus

Livrer : - `package.json` avec `start:dev`, `build`, `start:prod`,
`lint`, `test`, `test:e2e`, `prisma:generate`, `prisma:migrate`,
`prisma:seed`. - `prisma/schema.prisma` et migrations versionnées. -
`.env.example`, `.gitignore`, README en français. - Swagger/OpenAPI. -
Script/commande de création du premier admin avec hash du mot de
passe. - Tests unitaires et tests d'intégration. - Dockerfile et
`docker-compose.yml` API + MySQL souhaités. - Health check et données de
démonstration non sensibles en développement.

Ne pas lancer de migration destructive automatiquement en production.
Documenter les commandes d'installation, migration, seed, lancement et
tests.

## 12. Tests obligatoires

### Unitaires

-   Calcul de solde avec plusieurs paiements.
-   Paiements en attente exclus des recettes.
-   Refus d'un montant nul, négatif, sous le minimum ou supérieur au
    solde.
-   Prix figé au moment de l'inscription.
-   Inscription à un Sprint inactif refusée.
-   Confirmation répétée sans double comptage.
-   Référence, montant et devise vérifiés.
-   Signature webhook valide acceptée et signature invalide rejetée.

### Intégration

-   CRUD des Sprints.
-   Inscription d'un participant.
-   Double inscription empêchée.
-   Initialisation Paystack via mock.
-   Webhook valide qui confirme une seule fois.
-   Webhook invalide sans modification financière.
-   Routes admin interdites sans JWT.
-   Recherche, filtres et pagination.
-   Deux demandes concurrentes ne peuvent pas faire dépasser le solde.

Ne jamais utiliser de vrais paiements dans les tests automatisés :
mocker Paystack.

## 13. Critères d'acceptation

Le projet est accepté si : 1. Il démarre localement avec le README. 2.
Les migrations créent les tables, relations, index et contraintes. 3.
Swagger documente toutes les routes. 4. Un admin peut se connecter et
gérer les Sprints. 5. Un participant peut s'inscrire sans payer la
totalité. 6. Il peut effectuer plusieurs versements libres valides. 7.
Le solde dépend uniquement des paiements confirmés. 8. Aucun retour
navigateur ne suffit à confirmer un paiement. 9. Les webhooks invalides
sont rejetés. 10. Les événements répétés ne comptent jamais deux fois un
paiement. 11. Le mini-dashboard affiche les vrais chiffres. 12. Les
routes admin sont protégées. 13. Les tests et leur résultat sont
documentés. 14. Aucun secret réel n'est inclus. 15. `npm run build` et
les tests fournis passent.

## 14. Instructions impératives à Muse Code

1.  Inspecter le dépôt existant et conserver les conventions
    compatibles.
2.  Présenter brièvement le plan puis implémenter réellement.
3.  Créer NestJS modulaire, Prisma, configuration et migrations.
4.  Implémenter auth, guards et création sécurisée du premier admin.
5.  Implémenter CRUD Sprints, participants et inscriptions.
6.  Implémenter Paystack : initialisation, vérification serveur, webhook
    signé, idempotence.
7.  Implémenter calcul de solde, prévention de dépassement concurrent et
    dashboard.
8.  Ajouter DTO, validation, erreurs, logs sûrs et Swagger.
9.  Écrire et exécuter tests unitaires et d'intégration.
10. Exécuter le build, corriger les erreurs et signaler honnêtement tout
    test non exécuté.
11. Mettre à jour le README avec les commandes exactes.
12. Ne pas laisser de TODO sur les fonctions essentielles. Si une
    information Paystack manque, isoler l'hypothèse et la documenter ;
    ne jamais simuler un paiement réel réussi.

**Priorités absolues : exactitude des montants, sécurité Paystack,
calcul fiable des soldes, séparation des droits admin/participant et
livraison d'un projet exécutable.**

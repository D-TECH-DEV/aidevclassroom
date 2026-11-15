# PRD 01 - Authentification et administrateurs

**Modules couverts :** `aidev_api/src/auth`, `aidev_api/src/admins`, `aidev_api/src/cli/create-admin.ts`, `aidev_api/src/common/guards` | `aidevsprint/src/app/admin/connexion`, `aidevsprint/src/app/admin/actions.ts`, `aidevsprint/src/lib/admin/session.ts`, `aidevsprint/src/proxy.ts`

---

## 1. Objectif & Périmètre

Sécuriser l'accès au back-office de gestion des sprints, des inscriptions et des paiements via une authentification JWT réservée aux administrateurs, et permettre le provisionnement CLI ou API des comptes administrateurs tout en protégeant l'espace `/admin` côté Next.js.

Ce PRD ne couvre pas l'authentification des participants publics, qui repose sur un jeton de suivi par inscription (`trackingToken`, traité dans [PRD 03](file:///c:/projets/les_ultra_dev/aidevclassroom/docs/prd/03-inscriptions-et-participants.md)).

---

## 2. Acteurs & Rôles

| Acteur | Rôle technique | Accès et responsabilités |
|---|---|---|
| Administrateur | `User` avec `UserRole = ADMIN` et `isActive = true` | Se connecte sur `/admin/connexion`, consulte et pilote le back-office, peut gérer d'autres administrateurs et modifier son mot de passe via l'API. |
| Opérateur CLI / DevOps | Accès shell / conteneur backend | Crée le premier compte administrateur via `npm run admin:create` ([`create-admin.ts`](file:///c:/projets/les_ultra_dev/aidevclassroom/aidev_api/src/cli/create-admin.ts)) ou le seed de développement ([`seed.ts`](file:///c:/projets/les_ultra_dev/aidevclassroom/aidev_api/prisma/seed.ts)). |
| Visiteur anonyme | Non authentifié | Peut uniquement appeler `POST /api/v1/auth/login` (limité à 10 req/min) et afficher `/admin/connexion`. |

---

## 3. Modèle de données & Contrats (As-Is)

### 3.1 Table PostgreSQL `users` (`User`)

| Colonne | Type SQL | Contraintes & notes |
|---|---|---|
| `id` | `SERIAL` | Clé primaire auto-incrémentée |
| `name` | `VARCHAR(150)` | Requis |
| `email` | `VARCHAR(190)` | Unique (`users_email_key`), normalisé (`trim` + minuscules) |
| `password_hash` | `VARCHAR(255)` | Hash `bcrypt` (coût 12) ; jamais renvoyé dans les réponses (`sanitizeAdmin`) |
| `role` | `UserRole` | Enum limité à `'ADMIN'`, défaut `'ADMIN'` |
| `is_active` | `BOOLEAN` | Défaut `true` ; vérifié à chaque requête JWT |
| `created_at` / `updated_at` | `TIMESTAMP(3)` | Horodatage automatique |

### 3.2 Contrats DTO principaux (`As-Is`)

- `LoginDto` : `email` (`@IsEmail`), `password` (`@IsString`, `@IsNotEmpty`).
- `ChangePasswordDto` : `currentPassword` (non vide), `newPassword` (`8..128` caractères).
- `CreateAdminDto` : `name` (`<= 150`), `email` (`@IsEmail`), `password` (`8..128`).
- `UpdateAdminDto` : `name?` (`<= 150`), `email?` (`@IsEmail`), `isActive?` (booléen).

---

## 4. Fonctionnalités & Règles de gestion (As-Is)

### 4.1 Authentification JWT (`AuthService` / `JwtStrategy`)

- **RG-AUTH-01 (Normalisation et vérification uniforme)** : l'e-mail saisi est normalisé en minuscules ; en cas d'e-mail inexistant, mot de passe erroné ou compte `isActive = false`, l'API renvoie uniformément `401 INVALID_CREDENTIALS` afin de ne pas permettre l'énumération des comptes.
- **RG-AUTH-02 (Validation continue en base)** : `JwtStrategy.validate()` vérifie `ignoreExpiration: false` et recharge l'utilisateur en base sur chaque requête authentifiée ; un compte désactivé (`isActive = false`) voit son JWT immédiatement rejeté (`401 UNAUTHORIZED`).
- **RG-AUTH-03 (Changement de mot de passe)** : `POST /auth/change-password` exige `currentPassword` valide (sinon `401 INVALID_CURRENT_PASSWORD`) avant de re-hasher `newPassword` avec `bcrypt` coût 12.
- **RG-AUTH-04 (Déconnexion)** : aucun endpoint de déconnexion ni de refresh token n'existe côté API ; la déconnexion est purement côté frontend (suppression du cookie).

### 4.2 Administration des comptes (`AdminsService`)

- **RG-ADM-01 (Création forcée ADMIN)** : `POST /admins` force le rôle `'ADMIN'` et rejette tout doublon d'e-mail avec `409 ADMIN_EMAIL_EXISTS`.
- **RG-ADM-02 (Protection anti-auto-blocage)** : un administrateur ne peut pas se désactiver lui-même via `PATCH /admins/:id` (`isActive: false`) ni `PATCH /admins/:id/disable` (`400 CANNOT_DISABLE_SELF`).

### 4.3 Session BFF Next.js (`aidevsprint`)

- **RG-BFF-01 (Cookie opaque au navigateur)** : lors de la soumission du formulaire `/admin/connexion`, la Server Action appelle `POST /api/v1/auth/login` puis stocke le JWT dans le cookie `httpOnly`, `SameSite=lax` (`secure` en production) nommé `aidevsprint_admin`.
- **RG-BFF-02 (Double garde-fou `/admin`)** : `src/proxy.ts` redirige vers `/admin/connexion` toute requête `/admin/*` dépourvue du cookie (et redirige vers `/admin` si déjà connecté sur `/admin/connexion`). Chaque Server Component du panneau vérifie également la présence du cookie via `exigeSession()` et gère l'expiration API (`401`/`403` -> redirection `/admin/connexion`).

---

## 5. Routes API & Écrans Frontend (As-Is)

### 5.1 Endpoints Backend (`aidev_api`, préfixe `/api/v1`)

| Méthode | Route | Auth / Throttle | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public / `10 req/min` | Authentifie l'admin et retourne `{ accessToken, expiresIn, admin }` |
| `GET` | `/auth/me` | JWT `ADMIN` | Retourne le profil administrateur courant (sans `passwordHash`) |
| `POST` | `/auth/change-password` | JWT `ADMIN` | Met à jour le mot de passe de l'administrateur connecté |
| `GET` | `/admins` | JWT `ADMIN` | Liste tous les administrateurs (sans `passwordHash`) |
| `GET` | `/admins/:id` | JWT `ADMIN` | Détail d'un administrateur (`404 ADMIN_NOT_FOUND`) |
| `POST` | `/admins` | JWT `ADMIN` | Crée un nouvel administrateur |
| `PATCH` | `/admins/:id` | JWT `ADMIN` | Met à jour nom, e-mail ou activation |
| `PATCH` | `/admins/:id/disable` | JWT `ADMIN` | Désactive un administrateur (`isActive = false`) |

### 5.2 Écrans Frontend (`aidevsprint`)

| Route / Fichier | État | Description |
|---|---|---|
| `/admin/connexion` ([`page.tsx`](file:///c:/projets/les_ultra_dev/aidevclassroom/aidevsprint/src/app/admin/connexion/page.tsx)) | Opérationnel | Formulaire e-mail/mot de passe connecté à la Server Action de connexion |
| Bouton Déconnexion dans [`layout.tsx`](file:///c:/projets/les_ultra_dev/aidevclassroom/aidevsprint/src/app/admin/(panneau)/layout.tsx) | Opérationnel | Formulaire POST déclenchant l'action `deconnexion` (suppression du cookie) |
| Gestion admins & changement de mot de passe | Non exposé dans l'UI | Aucun écran `/admin/administrateurs` ni `/admin/profil` dans `aidevsprint` |

---

## 6. Cas limites, Sécurité & Erreurs

- **DTO strict** : `RegisterDto` présent dans `auth.dto.ts` n'est exposé par aucune route publique (pas d'auto-inscription admin).
- **Throttle & relais** : `POST /auth/login` appelle directement l'API depuis les Server Actions Next.js, ce qui protège le JWT mais partage l'IP du serveur frontend face à `ThrottlerGuard` (`10 req/min`) si `x-forwarded-for` n'est pas propagé.
- **Codes d'erreur clés** : `401 INVALID_CREDENTIALS`, `401 UNAUTHORIZED`, `401 INVALID_CURRENT_PASSWORD`, `403 FORBIDDEN`, `404 ADMIN_NOT_FOUND`, `409 ADMIN_EMAIL_EXISTS`, `400 CANNOT_DISABLE_SELF`, `429 TOO_MANY_REQUESTS`.
- **Logs** : `AllExceptionsFilter` redacte automatiquement `password`, `passwordHash` et `newPassword`.

---

## 7. Évolutions prévues (To-Be)

1. **Interface de changement de mot de passe (`/admin/compte`)** : exposer un formulaire permettant à l'administrateur connecté d'appeler `POST /api/v1/auth/change-password`.
2. **Écran de gestion des administrateurs (`/admin/administrateurs`)** : permettre la création, la modification et la désactivation de comptes admins directement depuis le panneau sans recourir à Postman/CLI.
3. **Propagation de l'IP client réelle** : transmettre l'IP client dans les requêtes Server Actions vers `POST /auth/login` afin que le rate-limit `10 req/min` s'applique par IP visiteur et non globalement au conteneur frontend.
4. **Révocation de session / Refresh Token** : envisager une liste de révocation ou des tokens à durée courte avec renouvellement si la durée de session (`JWT_EXPIRES_IN=8h`) devait être sécurisée contre le vol de session après déconnexion.


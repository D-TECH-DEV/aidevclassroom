# Authentification et permissions

Basé sur [auth.controller.ts](../../src/auth/auth.controller.ts), [auth.service.ts](../../src/auth/auth.service.ts), [jwt.strategy.ts](../../src/auth/jwt.strategy.ts), [jwt-auth.guard.ts](../../src/common/guards/jwt-auth.guard.ts), [roles.guard.ts](../../src/common/guards/roles.guard.ts).

## Rôles

Enum Prisma `UserRole` : une seule valeur, `ADMIN`. Tout le back-office exige `Roles('ADMIN')` + JWT valide. Il n'y a pas de rôle participant : les participants utilisent le **jeton de suivi** (`trackingToken`), pas le JWT.

## Connexion

`POST /api/v1/auth/login` — **publique**, throttle 10 req/min.

Body (`LoginDto`) :

```json
{ "email": "admin@exemple.com", "password": "MotDePasse123" }
```

- `email` : e-mail valide, normalisé (trim + minuscules).
- `password` : chaîne non vide.

Réponse `200` (`{ data, meta }`) :

```json
{
  "data": {
    "accessToken": "<jwt>",
    "expiresIn": "1h",
    "admin": { "id": 1, "name": "Admin", "email": "admin@exemple.com", "role": "ADMIN", "isActive": true, "createdAt": "...", "updatedAt": "..." }
  },
  "meta": {}
}
```

- Champ du token : `data.accessToken`. `passwordHash` n'est jamais exposé (`sanitizeAdmin`).
- Durée : `JWT_EXPIRES_IN` (défaut `1h`, cf. [env.validation.ts](../../src/config/env.validation.ts)). Le `JwtModule` signe en `1h` par défaut ; `JwtStrategy` a `ignoreExpiration: false`.
- Erreur : `401 { INVALID_CREDENTIALS, "Identifiants invalides." }` si e-mail inconnu, compte désactivé ou mot de passe faux.

## Utiliser le token

Header obligatoire sur chaque route admin :

```http
Authorization: Bearer <accessToken>
```

Exemple `fetch` :

```js
const res = await fetch("https://aidev.you-soft.com/api/v1/auth/me", {
  headers: { Authorization: `Bearer ${token}` }
});
```

Exemple Axios :

```js
api.defaults.headers.common.Authorization = `Bearer ${token}`;
```

## Profil et mot de passe (ADMIN)

- `GET /api/v1/auth/me` — retourne l'admin courant (sans `passwordHash`). `401 UNAUTHORIZED` si session invalide ou compte désactivé.
- `POST /api/v1/auth/change-password` — body `{ currentPassword, newPassword }`, `newPassword` 8–128 caractères. Erreur `401 INVALID_CURRENT_PASSWORD` si l'actuel est faux.

## Jeton de suivi participant (pas un JWT)

À la création d'une inscription (`POST /api/v1/enrollments`), le serveur génère `trackingToken` (hex 64 car.) et ne stocke que son hash SHA-256. **Il n'est renvoyé qu'une seule fois.** Le frontend doit le conserver et le transmettre ensuite via :

- header `x-tracking-token: <token>`, ou
- query `?trackingToken=<token>`, ou (sauf `verify`) body `trackingToken` — token de 16 car. minimum, comparé en `timingSafeEqual`.

Routes concernées : `GET /api/v1/enrollments/:id/status`, `POST /api/v1/payments/enrollments/:id/initialize`, `GET /api/v1/payments/:reference/verify` (alternative au JWT admin, voir [payment-access.guard.ts](../../src/payments/payment-access.guard.ts)).

## Routes sans token

Publiques : `GET /api/v1/health`, `POST /auth/login`, `POST /students`, `GET /sprints`, `GET /sprints/:id` (ACTIVE uniquement), `POST /enrollments`, `POST /payments/webhook/paystack` (signature Paystack, pas un navigateur).

## Erreurs 401 / 403

| Cas | Réponse |
|---|---|
| JWT absent ou mal formé | `401 { UNAUTHORIZED, ... }` (guard Passport) |
| JWT expiré ou compte désactivé | `401 { UNAUTHORIZED, "Session invalide..." }` |
| Login / mot de passe faux | `401 { INVALID_CREDENTIALS, ... }` |
| Token de suivi absent | `401 { TRACKING_TOKEN_REQUIRED, ... }` |
| Token de suivi faux | `401 { TRACKING_TOKEN_INVALID, ... }` |
| JWT valide mais rôle non ADMIN | `403 { FORBIDDEN, ... }` |

## Déconnexion / renouvellement

Aucun endpoint de déconnexion ni de refresh n'existe. Pour « déconnecter », supprimez le token côté frontend. Pour renouveler, reconnectez-vous via `/auth/login`. Il n'y a pas de révocation serveur : un token reste valide jusqu'à expiration sauf désactivation du compte (rejetée à chaque requête par `JwtStrategy`).

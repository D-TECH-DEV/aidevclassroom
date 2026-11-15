# PRD 05 - Dashboard et administration

**Modules couverts :** `aidev_api/src/dashboard`, `aidev_api/src/health` | `aidevsprint/src/app/admin/(panneau)/layout.tsx`, `aidevsprint/src/app/admin/(panneau)/page.tsx`, `aidevsprint/src/components/admin/*`, `aidevsprint/src/lib/admin/*`

---

## 1. Objectif & Périmètre

Fournir aux organisateurs un tableau de bord unifié regroupant les indicateurs financiers et opérationnels clés (encaissements, restes à percevoir, volumes d'inscriptions/participants, sessions actives, paiements en attente) ainsi qu'une console d'exploitation permettant de piloter sprints, dossiers d'inscriptions et transactions, complétée par une sonde de disponibilité technique (`/health`).

---

## 2. Acteurs & Rôles

| Acteur | Permissions et usage |
|---|---|
| Administrateur (`ADMIN`) | Accède à `/admin` et à ses sous-écrans (`/admin/sprints`, `/admin/inscriptions`, `/admin/paiements`) via session cookie `httpOnly` + JWT. |
| Docker / Nginx / CI-CD | Interroge `GET /api/v1/health` (sans authentification) pour vérifier la disponibilité du backend et de la base PostgreSQL. |

---

## 3. Modèle de données & Contrats (As-Is)

Le module `dashboard` ne possède pas de table dédiée ; il agrège en lecture les tables `students`, `sprints`, `enrollments` et `payments`.

### 3.1 Contrat `GET /api/v1/admin/dashboard/summary`

```json
{
  "totalStudents": 0,
  "activeSprints": 0,
  "totalEnrollments": 0,
  "totalCollectedXof": 0,
  "totalOutstandingXof": 0,
  "pendingPayments": { "count": 0, "amountXof": 0 },
  "recentEnrollments": [],
  "recentPayments": []
}
```

### 3.2 Contrat `GET /api/v1/health`

```json
{
  "status": "ok",
  "db": "up | down",
  "time": "2026-..."
}
```

Exécute `SELECT 1` via Prisma (`up` ou `down`) et retourne toujours HTTP `200` (sans guard JWT ni 401/404).

---

## 4. Fonctionnalités & Règles de gestion (As-Is)

### 4.1 Calculs d'agrégats (`DashboardService`)

- **RG-DSH-01 (Périmètre des encaissements)** : `totalCollectedXof` additionne exclusivement les paiements `SUCCESS`. `pendingPayments` agrège le nombre et le montant des paiements actuellement `PENDING`.
- **RG-DSH-02 (Périmètre des inscriptions)** : `totalEnrollments` exclut les inscriptions `CANCELLED`. `totalOutstandingXof` représente la somme des soldes restants (`max(0, totalAmountXof - totalPaidXof)`) sur les inscriptions non annulées.
- **RG-DSH-03 (Plafonnement actuel de `summary()`)** : `summary()` récupère jusqu'à `2000` inscriptions non annulées (`take: 2000`) puis calcule `totalOutstandingXof` en JavaScript. `recentEnrollments` et `recentPayments` renvoient les 10 derniers enregistrements (ou `limit` borné entre `1` et `50` sur les endpoints dédiés).
- **RG-DSH-04 (Séries journalières `collections`)** : `GET /admin/dashboard/collections?from&to` calcule `totalXof` et `count` via Prisma sur la plage `paidAt` demandée, et produit `byDay` (30 jours) via requête SQL brute groupée par `DATE("paid_at")`. **Anomalie identifiée :** la requête SQL brute produisant `byDay` ne filtre pas sur `from`/`to`.

### 4.2 Ergonomie du panneau `/admin` (`aidevsprint`)

- Rendu strictement dynamique (`export const dynamic = "force-dynamic"` dans `(panneau)/layout.tsx`), entouré de frontières `<Suspense>`.
- Navigation à 4 entrées : `Tableau de bord`, `Sprints`, `Inscriptions`, `Paiements`.
- Filtres persistés en query string URL (`?statut=&search=&page=` ou `?statut=&reference=&page=`) pour permettre le partage d'URL et l'usage du bouton Retour navigateur.
- Affichage des boutons de transition d'inscription filtré selon `TRANSITIONS` et la règle `remainingAmountXof === 0` pour `COMPLETED` (l'écran affiche un message explicatif tant que le dossier n'est pas soldé).
- Libellés, dates (`fr-FR`) et montants (`X XXX FCFA` sans décimales) centralisés dans `src/lib/admin/types.ts`.

---

## 5. Routes API & Écrans Frontend (As-Is)

### 5.1 Endpoints Backend (`/api/v1`)

| Méthode | Route | Auth | Exposition UI |
|---|---|---|---|
| `GET` | `/health` | Public | Utilisé par Docker healthcheck et `scripts/ci-deploy.sh` |
| `GET` | `/admin/dashboard/summary` | JWT `ADMIN` | Utilisé par `/admin` |
| `GET` | `/admin/dashboard/recent-enrollments` | JWT `ADMIN` | Non appelé directement (couvert par `summary`) |
| `GET` | `/admin/dashboard/recent-payments` | JWT `ADMIN` | Non appelé directement (couvert par `summary`) |
| `GET` | `/admin/dashboard/collections` | JWT `ADMIN` | Non exposé dans l'UI |
| `GET` | `/admin/dashboard/outstanding-balances` | JWT `ADMIN` | Non exposé dans l'UI |

### 5.2 Écrans Frontend (`/admin`)

| Route | Contenu |
|---|---|
| `/admin` | 6 tuiles KPI + tableaux des 10 dernières inscriptions et 10 derniers paiements |
| `/admin/sprints` (+ `nouveau`, `[id]/modifier`) | Gestion catalogue et statuts sprints (voir [PRD 02](file:///c:/projets/les_ultra_dev/aidevclassroom/docs/prd/02-sprints-et-catalogue.md)) |
| `/admin/inscriptions` (+ `[id]`) | Suivi inscriptions et transitions (voir [PRD 03](file:///c:/projets/les_ultra_dev/aidevclassroom/docs/prd/03-inscriptions-et-participants.md)) |
| `/admin/paiements` | Liste paiements et revérification (voir [PRD 04](file:///c:/projets/les_ultra_dev/aidevclassroom/docs/prd/04-paiements-et-paystack.md)) |

---

## 6. Cas limites, Sécurité & Erreurs

- **Incohérence `collections()`** : passer `?from=...&to=...` met à jour `totalXof` et `count`, mais `byDay` renvoie toujours les 30 derniers jours toutes périodes confondues (et retourne `[]` silencieusement en cas d'erreur SQL).
- **Limite mémoire 2000 dossiers** : au-delà de 2000 inscriptions non annulées, `totalOutstandingXof` dans `summary()` sous-estimera le reste à encaisser réel.
- **UX de défilement** : `<ScrollFluide />` (Lenis) est injecté dans le `RootLayout` racine (`src/app/layout.tsx`) et s'applique donc également aux pages tabulaires `/admin`.
- **Gestion expiration session** : toute réponse `401`/`403` interceptée par `sessionPerdue()` déclenche une redirection propre vers `/admin/connexion`.

---

## 7. Évolutions prévues (To-Be)

1. **Corriger et optimiser les requêtes `DashboardService`** : appliquer les filtres `from`/`to` dans la requête SQL `byDay` de `collections()`, et calculer `totalOutstandingXof` par agrégation SQL directe plutôt qu'avec `take: 2000` en mémoire.
2. **Exposer les vues analytiques dans `/admin`** : ajouter une vue d'encaissements journaliers (`collections`) et une vue dédiée aux soldes restants à recouvrer (`outstanding-balances`) avec filtrage par sprint et export CSV.
3. **Désactiver Lenis sur le groupe `/admin`** : restreindre `<ScrollFluide />` aux routes publiques afin de conserver un défilement natif réactif dans les tableaux d'administration.
4. **Ajouter les écrans d'administration manquants** : participants (`/admin/participants` via `/admin/students*`) et comptes admins / mot de passe (`/admin/compte`, `/admin/administrateurs`).


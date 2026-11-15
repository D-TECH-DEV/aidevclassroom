# Index des PRD - Aidev Classroom (`aidevclassroom`)

Ce dossier regroupe les spécifications produit (PRD) déduites par rétro-ingénierie des modules existants du monorepo (`aidev_api` et `aidevsprint`).

Chaque document suit une structure homogène en 7 sections et distingue systématiquement :

- **État actuel (`As-Is`)** : comportement réellement implémenté et vérifié dans le code source.
- **Évolutions prévues (`To-Be`)** : manques identifiés, fonctionnalités backend non exposées dans l'interface, dettes techniques à résorber et chantiers fonctionnels découlant de l'architecture existante.

**Note de périmètre (Mono-tenant) :** L'application et son schéma PostgreSQL fonctionnent actuellement en mode mono-tenant (pas de colonne `site_id` ni de politiques RLS). Les PRDs décrivent le périmètre fonctionnel mono-tenant existant ; l'écart avec la règle multi-tenant de [`AGENTS.md`](file:///c:/projets/les_ultra_dev/aidevclassroom/AGENTS.md) est documenté dans [`ARCHITECTURE.md`](file:///c:/projets/les_ultra_dev/aidevclassroom/ARCHITECTURE.md).

---

## Catalogue des PRDs

| N° | Document | Modules Backend (`aidev_api`) | Écrans / Fichiers Frontend (`aidevsprint`) | Statut fonctionnel |
|---|---|---|---|---|
| 01 | [01 - Authentification et administrateurs](file:///c:/projets/les_ultra_dev/aidevclassroom/docs/prd/01-authentification-et-administrateurs.md) | `auth`, `admins`, `cli/create-admin.ts`, `common/guards` | `/admin/connexion`, `src/proxy.ts`, `src/lib/admin/session.ts`, `src/app/admin/actions.ts` | Connexion UI opérationnelle ; gestion multi-admins et changement de mot de passe API-only |
| 02 | [02 - Sprints et catalogue](file:///c:/projets/les_ultra_dev/aidevclassroom/docs/prd/02-sprints-et-catalogue.md) | `sprints` | `/`, `/admin/sprints`, `/admin/sprints/nouveau`, `/admin/sprints/[id]/modifier`, `src/lib/edition.ts` | CRUD admin et catalogue public opérationnels (forfaits Solo/Duo inclus) |
| 03 | [03 - Inscriptions et participants](file:///c:/projets/les_ultra_dev/aidevclassroom/docs/prd/03-inscriptions-et-participants.md) | `enrollments`, `students` | `ModaleInscription`, `FormulaireInscription`, `/paiement/reprendre`, `/admin/inscriptions`, `/admin/inscriptions/[id]` | Parcours complet côté inscriptions ; CRUD `/admin/students` API-only |
| 04 | [04 - Paiements et Paystack](file:///c:/projets/les_ultra_dev/aidevclassroom/docs/prd/04-paiements-et-paystack.md) | `payments` (`PaymentsService`, `PaystackService`, `balance.util.ts`) | `ParcoursPaiement`, `ReprendrePaiement`, `RetourPaiement`, `/paiement/retour`, `/admin/paiements` | Double flux (Mobile Money Charge + Hosted Checkout), webhook HMAC et réconciliation opérationnels |
| 05 | [05 - Dashboard et administration](file:///c:/projets/les_ultra_dev/aidevclassroom/docs/prd/05-dashboard-et-administration.md) | `dashboard`, `health`, ensemble `/admin/*` | `/admin/(panneau)/layout.tsx`, `/admin` et sous-pages | Vue synthèse et gestion opérationnelles ; endpoints analytiques partiellement non exposés |
| 06 | [06 - Vitrine et parcours public](file:///c:/projets/les_ultra_dev/aidevclassroom/docs/prd/06-vitrine-et-parcours-public.md) | `sprints` (public), relais Next.js `/api/[...chemin]` | `/` (`app/page.tsx`), sections marketing, `Navbar`, `Footer`, badges 3D WebGL, `SeatsGauge` | Vitrine déployée avec quelques contenus éditoriaux en attente (`[À COMPLÉTER]` / `[À DÉTERMINER]`) |


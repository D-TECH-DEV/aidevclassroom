# PRD 06 - Vitrine et parcours public

**Modules couverts :** `aidev_front/src/app/page.tsx`, `aidev_front/src/app/layout.tsx`, `aidev_front/src/app/globals.css`, `aidev_front/src/app/api/[...chemin]/route.ts`, `aidev_front/src/components/{hero,sections,formateurs,backgrounds,layout,motion,ui,inscription}` | `aidev_front/src/lib/{edition.ts,contenu.ts,usePlacesSprint.ts,formateurs.ts,api.ts}`

---

## 1. Objectif & Périmètre

Présenter l'offre de formation AIdevsprint (« Le vibe coding, bien fait » - une journée intensive à Yamoussoukro pour livrer un portfolio en ligne en guidant l'IA avec des compétences d'ingénierie), convaincre le visiteur via un parcours narratif et visuel soigné, et déclencher sans rupture l'ouverture de la modale d'inscription depuis n'importe quel point de la page.

---

## 2. Acteurs & Rôles

| Acteur | Interaction avec la vitrine |
|---|---|
| Visiteur / Développeur candidat | Parcourt la landing page sur desktop ou mobile, manipule les badges 3D WebGL, consulte le programme, les tarifs Solo/Duo et la FAQ, puis réserve sa place via la modale ou reprend un paiement via `/paiement/reprendre`. |
| Équipe éditoriale / Formateurs | Alimente les données sprints dynamiques via `/admin/sprints` et les contenus éditoriaux globaux (`site_settings`, `trainers`, `faqs`) via `/admin/contenu`. |

---

## 3. Modèle de données & Contrats (As-Is)

### 3.1 Hydratation SSR (`GET /api/v1/sprints` et `GET /api/v1/site-content`)

`aidev_front/src/app/page.tsx` charge en parallèle côté serveur :
- les sprints publics via `recupereSprints()` (`src/lib/edition.ts`), qui transforme chaque sprint API en objet `Edition` (`id`, `nom`, `slug`, `prixFCFA`, `minimumFCFA`, `prixDuoFCFA`, `minimumDuoFCFA`, `debut`, `fin`, `quota`, `inscrits`, `statut`, `ville`, `lieu`, `format`, `niveau`, `modules`, avec replis `FAITS_LOCAUX` et `MODULES_DEFAUT`) ;
- le contenu éditorial global via `recupereContenuSite()` (`src/lib/contenu.ts`), qui interroge `GET /site-content` (`whatsappDisplay`, `whatsappHref`, `trainers`, `faqs`).

### 3.2 Rafraîchissement client & relais navigateur (`As-Is`)

- **Jauge en direct (`src/lib/usePlacesSprint.ts`)** : `usePlacesSprint()` rafraîchit le compteur `inscrits / quota` côté client via `GET /api/sprints/:id/enrolled-count` (`cache: "no-store"`) et écoute `aidev:inscription-maj` pour `SeatsGauge` et `Navbar`.
- **Relais navigateur (`src/app/api/[...chemin]/route.ts`)** : liste blanche stricte des préfixes relayés (`sprints`, `site-content`, `enrollments`, `payments`, `students`, `health`), en mode même-origine sans exposition de l'URL backend privée.
- **Compatibilité formateurs (`src/lib/formateurs.ts`)** : fichier historique conservé par prudence mais non importé par la vitrine (les formateurs proviennent désormais de `GET /site-content`).

---

## 4. Fonctionnalités & Règles de gestion (As-Is)

### 4.1 Structure de la page d'accueil (`/`)

La landing page assemble dans un contexte `ModaleInscription` (géré par `<dialog>` natif) :
1. **`Navbar`** : en-tête fixe adaptatif (`IntersectionObserver` sur sentinelle), ancres (`#methode`, `#parcours`, `#formateurs`, `#faq`), menu plein écran sur mobile (`MenuPleinEcran`) et bouton CTA `BoutonReserver`.
2. **`Hero`** : fond WebGL (`Aurora`), titre, présentation des modules du programme (`ModulesProgramme`), carte d'informations pratiques (`CarteInfos` : date, compte à rebours `CountdownFlip`, jauge de places `SeatsGauge`, tarifs).
3. **`Probleme`** : comparaison en deux cartes (« Sans méthode » vs « Avec méthode AIdevsprint »).
4. **`Methode`** : grille des 4 piliers (`.md` Le contexte, `{ }` Les skills, `>_` Les bons prompts, `</>` Revue & sécurité).
5. **`Parcours`** : déroulé du programme pratique de la session.
6. **`Formateurs`** : présentation alternée des 3 intervenants avec badge 3D interactif (`BadgeSuspendu` / `Lanyard.tsx` sous Three.js, montage décalé de `260 ms` par badge sur desktop `>= lg`, remplacé par le portrait détouré sous `lg`).
7. **`Session`** : modalités logistiques, tarification Solo / Duo, jauge et canal de secours humain WhatsApp (`07 04 92 10 80` / `https://wa.me/2250704921080`).
8. **`Faq`** : questions-réponses fréquentes en accordéon.
9. **`CtaFinal`** + **`Footer`** : dernier appel à l'action et pied de page avec année dynamique.

### 4.2 Design System, Accessibilité & Motion (`globals.css`, `layout.tsx`)

- **RG-VIT-01 (Thème sombre exclusif)** : `color-scheme: dark`, tokens Tailwind v4 dans `@theme` (`--color-bg: #010101`, `--color-surface: #010f06`, `--color-surface-blue: #01060f`, `--color-accent: #2ee66b`, `--color-cta: #0b63f6`, `--gradient-signature`).
- **RG-VIT-02 (Typographie et espacements fluides)** : `Inter` et `JetBrains Mono`, échelles `clamp(...)` bornées par `vw` et `svh`, unité `--spacing` fluide, rayon `--radius-card: 1.5rem`, `--radius-field: 0.625rem`, `--radius-pill: 9999px`.
- **RG-VIT-03 (Respect du scroll et de la réduction de mouvement)** : `@custom-variant hoverable` pour éviter les états `:hover` collés sur tactile ; animations GSAP (`Reveal`, `SeatsGauge`) compatibles `prefers-reduced-motion: reduce` ; Lenis mis en pause/repris à l'ouverture/fermeture de `<dialog>` (`arreteDefilement`/`repartDefilement`) et `data-lenis-prevent` sur la modale.
- **RG-VIT-04 (État sans sprint actif)** : si aucune édition `ACTIVE` n'existe, `ModaleInscription` s'ouvre tout de même pour afficher un message informatif et le contact WhatsApp plutôt qu'un bouton muet.

---

## 5. Routes API & Écrans Frontend (As-Is)

| Route / Endpoint | Côté | Rôle |
|---|---|---|
| `/` (`src/app/page.tsx`) | Frontend SSR | Landing page complète |
| `/paiement/reprendre` | Frontend | Reprise d'inscription/solde par e-mail (sans navbar, avec footer) |
| `/paiement/retour` | Frontend | Vérification Paystack au retour (sans navbar, `robots: noindex, nofollow`) |
| `GET /api/[...chemin]` & `POST /api/[...chemin]` | Frontend Route Handler | Relais vers `aidev_api` limité à `sprints`, `site-content`, `enrollments`, `payments`, `students`, `health` |
| `GET /api/v1/sprints` | Backend API | Liste des sprints `ACTIVE` et `INACTIVE` |
| `GET /api/v1/site-content` | Backend API | Contenus éditoriaux globaux (`whatsappDisplay`, `whatsappHref`, `trainers`, `faqs`) |

---

## 6. Cas limites, Sécurité & Données incomplètes

- **Contenus éditoriaux et replis (`As-Is`)** :
  - `SeatsGauge` et `Navbar` affichent `[À DÉTERMINER]` si `quota` ou `inscrits` ne sont pas encore disponibles.
  - `Formateurs` et `Faq` affichent `[À COMPLÉTER]` si un champ éditorial issu de `GET /site-content` est vide/null côté base.
- **Relais `/api/[...chemin]` et rate-limit** : les en-têtes `x-forwarded-for` du visiteur ne sont pas transmis au backend ; tous les appels publics navigateur arrivent sur NestJS avec l'IP du conteneur frontend.
- **Dépendance JS sur la modale** : sans JavaScript côté client, la réservation en modale n'est pas disponible (le repli reste le lien direct WhatsApp dans la section `Session`).
- **Absence de tests frontend automatisés** : la CI valide uniquement `tsc --noEmit` et `npm run build` (`aidev_front/package.json` ne comporte pas de script `test`).

---

## 7. Évolutions prévues (To-Be)

1. **Corriger le transfert IP dans `/api/[...chemin]/route.ts`** : transmettre l'IP client via `x-forwarded-for` et configurer Express `trust proxy` côté NestJS pour isoler les quotas anti-spam par visiteur.
2. **Ajouter une suite de tests E2E / composants sur `aidev_front`** : couvrir au moins les flux critiques (ouverture modale, validation Solo/Duo, parcours Charge/Checkout simulé, `/paiement/retour` et `/paiement/reprendre`).
3. **Upload direct d'images formateurs** : permettre l'envoi de portraits et textures de badges 3D depuis `/admin/contenu` sans dépôt manuel préalable dans `aidev_front/public/`.

# PRD 06 - Vitrine et parcours public

**Modules couverts :** `aidevsprint/src/app/page.tsx`, `aidevsprint/src/app/layout.tsx`, `aidevsprint/src/app/globals.css`, `aidevsprint/src/app/api/[...chemin]/route.ts`, `aidevsprint/src/components/{hero,sections,formateurs,backgrounds,layout,motion,ui,inscription}` | `aidevsprint/src/lib/{edition.ts,formateurs.ts,api.ts}`

---

## 1. Objectif & Périmètre

Présenter l'offre de formation AIdevsprint (« Le vibe coding, bien fait » - une journée intensive à Yamoussoukro pour livrer un portfolio en ligne en guidant l'IA avec des compétences d'ingénierie), convaincre le visiteur via un parcours narratif et visuel soigné, et déclencher sans rupture l'ouverture de la modale d'inscription depuis n'importe quel point de la page.

---

## 2. Acteurs & Rôles

| Acteur | Interaction avec la vitrine |
|---|---|
| Visiteur / Développeur candidat | Parcourt la landing page sur desktop ou mobile, manipule les badges 3D WebGL, consulte le programme, les tarifs Solo/Duo et la FAQ, puis réserve sa place via la modale ou reprend un paiement via `/paiement/reprendre`. |
| Équipe éditoriale / Formateurs | Alimente les données sprints dynamiques via l'admin et maintient les contenus statiques (`edition.ts`, `formateurs.ts`, `Faq.tsx`). |

---

## 3. Modèle de données & Contrats (As-Is)

### 3.1 Hydratation SSR (`GET /api/v1/sprints` -> `Edition`)

`aidevsprint/src/app/page.tsx` charge côté serveur les sprints publics via `editionsOuvertes()` (`src/lib/edition.ts`), qui transforme chaque sprint API en objet `Edition` :
- `id`, `nom`, `slug`, `prixFCFA`, `minimumFCFA`, `prixDuoFCFA`, `minimumDuoFCFA`, `debut`, `fin`, `quota`, `statut`.
- Champs encore figés/manquants côté API publique : `inscrits: null`, `FAITS_LOCAUX` (`ville`, `lieu`, `format` définis en dur dans `edition.ts`).

### 3.2 Données éditoriales statiques (`As-Is`)

- **`FORMATEURS` (`src/lib/formateurs.ts`)** : 3 intervenants (`Youssouf`, `Malik`, `Victorien`) avec portraits (`/formateurs/*.png`) et textures de badges 3D (`/badges/*.png`).
- **Relais navigateur (`src/app/api/[...chemin]/route.ts`)** : liste blanche stricte des préfixes relayés (`sprints`, `enrollments`, `payments`, `students`, `health`), en mode même-origine sans exposition de l'URL backend privée.

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
| `GET /api/[...chemin]` & `POST /api/[...chemin]` | Frontend Route Handler | Relais vers `aidev_api` limité à `sprints`, `enrollments`, `payments`, `students`, `health` |
| `GET /api/v1/sprints` | Backend API | Liste des sprints `ACTIVE` et `INACTIVE` |

---

## 6. Cas limites, Sécurité & Données incomplètes

- **Contenus éditoriaux non finalisés (`As-Is`)** :
  - `SeatsGauge` affiche `Nombre de places [À DÉTERMINER]` tant que `inscrits` vaut `null` dans `edition.ts`.
  - `formateurs.ts` contient plusieurs champs à `null` (`nom`, `transmet` de Victorien, `liens`) rendus avec `[À COMPLÉTER]`.
  - `Faq.tsx` contient une réponse #3 à `null` rendue avec `[À COMPLÉTER]`.
- **Relais `/api/[...chemin]` et rate-limit** : les en-têtes `x-forwarded-for` du visiteur ne sont pas transmis au backend ; tous les appels publics navigateur arrivent sur NestJS avec l'IP du conteneur frontend.
- **Dépendance JS sur la modale** : sans JavaScript côté client, la réservation en modale n'est pas disponible (le repli reste le lien direct WhatsApp dans la section `Session`).
- **Absence de tests frontend automatisés** : la CI valide uniquement `tsc --noEmit` et `npm run build` (`aidevsprint/package.json` ne comporte pas de script `test`).

---

## 7. Évolutions prévues (To-Be)

1. **Compléter les données éditoriales manquantes** : renseigner le profil de Victorien et les liens sociaux dans `formateurs.ts`, la réponse #3 dans `Faq.tsx`, et dynamiser/confirmer le lieu et le format précis (ou les rattacher au modèle `Sprint` en base).
2. **Brancher `SeatsGauge` sur le taux de remplissage réel** : consommer le futur champ public de places occupées renvoyé par `GET /api/v1/sprints` afin d'afficher la jauge animée en temps réel.
3. **Corriger le transfert IP dans `/api/[...chemin]/route.ts`** : transmettre l'IP client via `x-forwarded-for` et configurer Express `trust proxy` côté NestJS pour isoler les quotas anti-spam par visiteur.
4. **Ajouter une suite de tests E2E / composants sur `aidevsprint`** : couvrir au moins les flux critiques (ouverture modale, validation Solo/Duo, parcours Charge/Checkout simulé, `/paiement/retour` et `/paiement/reprendre`).

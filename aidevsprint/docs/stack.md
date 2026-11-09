# Stack

Versions relevées sur npm le 2026-10-05. Rien n'est encore installé :
ce document est la cible, pas un état des lieux.

## Vue d'ensemble

```
Next.js (front, site public)  ──fetch REST──▶  API Aidev Classroom (NestJS)
         │                                            │
    GSAP + Lenis                                 base de données
    React Bits                                   (à choisir)
```

Deux applications séparées, deux déploiements, deux `package.json`.
Le front ne parle jamais à la base : tout passe par l'API, et un seul
module du site l'appelle (`src/lib/api.ts`).
Deux langages, donc : TypeScript devant, PHP derrière.

## Frontend

| Quoi | Choix | Version | Pourquoi |
|------|-------|---------|----------|
| Framework | Next.js (App Router) | `16.3.8` | SSR/SSG pour le SEO, server components pour appeler l'API sans exposer le token |
| UI | React | `19.3.0` | imposé par Next |
| Animation | GSAP | `3.15.0` | timelines + ScrollTrigger ; la référence pour du scroll-driven sérieux |
| Intégration React | `@gsap/react` | `2.1.2` | hook `useGSAP`, nettoie les animations au démontage |
| Smooth scroll | Lenis | `1.3.26` | scroll inertiel, se branche sur ScrollTrigger |
| Composants animés | React Bits | — | 200+ composants à copier dans le repo, pas une dépendance |
| Styles | Tailwind CSS | `4.3.3` | config CSS-first, tokens de design directement dans `@theme` |
| Langage | TypeScript | `7.0.2` | types du front ; l'API étant en PHP, ses types sont écrits à la main dans `src/lib/` |

### GSAP + Lenis : la règle

Les deux touchent au scroll, donc ils doivent être synchronisés, sinon
ScrollTrigger se déclenche sur de mauvaises positions. Un seul endroit dans
l'app branche Lenis sur le ticker GSAP et sur `ScrollTrigger.update()`.
Détail d'implémentation à écrire ici une fois le provider en place.

Toujours animer via `useGSAP` (scope + cleanup automatique). Jamais de
`gsap.to()` nu dans un `useEffect` en React 19 — le double rendu du mode strict
empile les animations.

Skills disponibles pour ça : `/gsap-skills:gsap-core`, `gsap-scrolltrigger`,
`gsap-timeline`, `gsap-react`, `gsap-plugins`, `gsap-performance`.

**Répartition GSAP / CSS — décidé le 2026-10-15.** Les skills `emilkowalski` partent du
principe qu'un survol, une pression ou un changement d'état se fait en
transition CSS (interruptible, hors thread principal), et réservent le JS aux
séquences dynamiques. **GSAP pour le scroll et les timelines, CSS pour les micro-interactions**
(survol, pression, changement d'état) : interruptibles et hors thread
principal.
**Framer Motion est écarté (2026-10-15).** Le brief disait « Framer Motion
et/ou GSAP » ; on garde **GSAP + Lenis seuls**. Deux bibliothèques d'animation,
c'est du poids en double pour le même travail. Les exemples de skills qui
importent `framer-motion` sont à transposer en GSAP.

### Tailwind 4 : ce qui change

Pas de `tailwind.config.js`. La configuration est en CSS :

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-bg:     #…;
  --color-accent: #…;
  --font-display: "…", sans-serif;
}
```

Chaque entrée de `@theme` génère les utilitaires correspondants
(`bg-bg`, `text-accent`, `font-display`) **et** une variable CSS utilisable
partout, y compris depuis GSAP.

Conséquence directe : les tokens de [design.md](design.md#tokens) ne sont pas
recopiés à la main dans un fichier de config — `@theme` *est* leur
implémentation. Une seule source de vérité.

Build : plugin PostCSS `@tailwindcss/postcss` (`4.3.3`).

### React Bits

[reactbits.dev](https://reactbits.dev/) — 200+ composants React animés (textes,
backgrounds, micro-interactions). Modèle shadcn : on **copie le code source dans
le projet**. Le composant devient le nôtre, on l'édite librement, et il n'y a pas
de mise à jour automatique à gérer.

Trois façons d'installer, au choix et par composant :

```bash
# shadcn CLI (le plus direct si on a déjà shadcn)
npx shadcn@latest add @react-bits/BlurText-TS-TW   # suffixe TS-TW, toujours

# jsrepo
# commande exacte affichée sur la page de chaque composant

# ou copie manuelle depuis le site
```

Chaque page de composant affiche la commande prête à coller.

**Quatre variantes existent (`JS-CSS`, `JS-TW`, `TS-CSS`, `TS-TW`) — ici c'est
`TS-TW`, sans exception.** Le suffixe se choisit à l'installation ; mélanger les
variantes oblige à reprendre les composants à la main.

- Destination des composants copiés : `src/components/bits/` (à créer).
- Licence : MIT + Commons Clause — usage libre dans un produit ; la clause vise
  la revente de la bibliothèque elle-même. À relire si le projet devient un
  produit vendu.

## Backend — l'API Aidev Classroom

**Décidé le 2026-10-28.** Le site consomme l'API que Youssouf a construite et
déployée. Le Laravel + Filament du 2026-10-19 (`backend/`) est **supprimé** :
il n'a jamais été déployé, n'avait ni paiement ni compte admin, et faire
vivre deux back-ends pour une seule formation n'avait pas de sens. Son code
reste dans l'historique git jusqu'au commit de suppression.

| | |
|---|---|
| Pile | NestJS + Prisma + PostgreSQL + JWT + **Paystack** |
| Base publique | `https://aidev.you-soft.com` |
| Base API | `https://aidev.you-soft.com/api/v1` |
| Swagger | `https://aidev.you-soft.com/api/docs` |
| Santé | `GET /api/v1/health` → `{ status, db, time }` |
| Doc | [docs/api/](./api/) — copie de l'archive du 2026-10-27 |

Côté site, **un seul module touche à `fetch`** : `src/lib/api.ts`. Il déballe
l'enveloppe `{ data, meta }`, transforme `{ statusCode, code, message }` en
`ErreurApi`, et distingue une erreur métier d'un serveur injoignable
(`ErreurReseau`). Le jour où la base change, elle change là.

L'adresse vient de `NEXT_PUBLIC_API_URL` (voir `.env.example`). Pas de valeur
par défaut : un repli silencieux sur une adresse en dur partirait en
production et perdrait les inscriptions sans bruit.

### Du `Sprint` de l'API à l'`Edition` du site

`src/lib/edition.ts` fait la traduction. `GET /sprints?page=1&limit=1` ne
renvoie que les sprints `ACTIVE`, triés du plus récent au plus ancien : le
premier est l'édition en cours.

| Site | API | Note |
|---|---|---|
| `id` | `id` | c'est le `sprintId` que le formulaire renvoie |
| `nom` | `name` | remplace l'ancien « session #N » — l'API n'a pas de numéro |
| `dateDebut` | `startAt` | |
| `prixFCFA` | `priceXof` | |
| `minimumFCFA` | `minimumPaymentXof` | le minimum par versement, pour le paiement fractionné |
| `quota` | `capacity` | `null` = illimité |
| `inscrits` | — | **n'existe pas** sur la route publique |
| `ville`, `lieu`, `format` | — | **n'existent pas** dans le modèle |

### Ce que l'API ne porte pas

Le modèle `Sprint` a été écrit pour des sprints de plusieurs semaines, pas
pour une journée dans une salle précise. Il manque donc :

- **le lieu et la ville** — tenus dans `FAITS_LOCAUX` (`src/lib/edition.ts`).
  Ce sont des faits confirmés (affiche + Malik le 2026-10-19), pas du
  remplissage. Le jour où l'API gagne les champs, `FAITS_LOCAUX` meurt ;
- **le format** (« 1 journée · présentiel ») — même traitement ;
- **le nombre d'inscrits** — il n'existe que sur `/admin/enrollments`. La
  jauge du hero et le compteur de la navbar affichent donc [À DÉTERMINER] ;
- **les formateurs** — aucune route, aucun modèle. Ils restent en dur dans
  `src/lib/formateurs.ts`, comme avant.

### Sans édition

Tant qu'aucun sprint n'est `ACTIVE`, le catalogue public est vide et
`recupereEdition()` renvoie `null`. **C'est le cas aujourd'hui.** Le site se
montre alors sans date, sans prix et sans places — en [À DÉTERMINER], jamais
avec d'anciennes valeurs — et la modale dit que les inscriptions ne sont pas
ouvertes au lieu de proposer un formulaire qui serait refusé. Une API
injoignable donne le même `null` : la page se construit quand même.

### Le formulaire côté site

Une **modale**, ouverte par n'importe quel « Réserver ma place » — voir
`src/components/inscription/`. Il poste `POST /enrollments` :

```json
{ "sprintId": 3, "student": { "firstName": "Konan", "lastName": "Yao", "email": "konan@exemple.ci", "phone": "+2250704921080" } }
```

Deux pièges de ce contrat :

1. **Prénom et nom séparés.** Le champ unique « nom complet » a disparu.
2. **Téléphone en E.164 strict.** Le motif attendu est un `+`, un chiffre
   non nul, puis 6 à 17 chiffres. Personne n'écrit son numéro comme ça ici,
   donc `normaliseTelephone()` accepte la forme locale et ajoute `+225`
   quand il y a dix chiffres. Refuser « 07 04 92 10 80 » ferait perdre des
   inscriptions.

La réponse `201` porte un **`trackingToken`**, renvoyé une seule fois. Il est
rangé dans `localStorage` sous `aidevsprint.suivi.<id>`. Sans lui, le
participant ne peut plus ni suivre son dossier ni payer.

### Ce que Youssouf doit faire de son côté

> Tout ce qui suit lui est expliqué, mesures et commandes à l'appui, dans
> [pour-youssouf.md](./pour-youssouf.md) — le document à lui transmettre.


> Relevé du 2026-11-07 : l'essentiel est fait. Le site est en ligne sur
> **`ai-devclassroom.com`** (le domaine a changé, `ai-dev-sprint.com`
> n'a jamais été pris), servi depuis le serveur de Youssouf —
> `212.47.73.163`, la même machine que l'API. Le sprint #1 existe et est
> `ACTIVE`. Il reste deux points, plus deux questions.

- [ ] **Exposer un compteur d'inscrits sur la route publique.** C'est le
      dernier `[À DÉTERMINER]` visible du site, et il apparaît deux fois :
      la pastille « Places » du hero et le « Nombre de places » de la
      section Session. `GET /sprints` porte bien `capacity`, mais aucun
      décompte : `SeatsGauge` exige les deux pour afficher quoi que ce
      soit (`inscrits !== null && quota !== null`), donc `edition.ts`
      laisse `inscrits` à `null`. Sans ce champ, impossible d'annoncer
      « il reste N places » sans l'inventer. À défaut, décider côté site
      de n'afficher que la capacité.
- [ ] **Réparer `GET /enrollments/:id/status`.** Mesuré le 2026-11-01 :
      renvoie `500 INTERNAL_ERROR` dans tous les cas — sans jeton, avec un
      jeton invalide, sur un identifiant inexistant. La doc annonce
      `401 TRACKING_TOKEN_REQUIRED` ou `404 ENROLLMENT_NOT_FOUND` : le
      guard plante avant de décider. Le site ne consomme pas cette route
      aujourd'hui, donc rien n'est bloqué — mais c'est la route qui
      permettrait au participant de retrouver son dossier.
- [ ] **Confirmer `PAYSTACK_CALLBACK_URL`.** Elle doit pointer sur
      `https://ai-devclassroom.com/paiement/retour`. Invisible de
      l'extérieur, donc invérifiable par nous. Tant qu'elle ne pointe pas
      là, le participant paie et atterrit ailleurs — l'argent part, la
      confirmation non.
- [ ] Dire s'il part **un email** à l'inscription. Rien dans la doc n'en
      parle, donc le site n'en promet aucun.

Réglés depuis :

- [x] **Le site est hébergé** et le domaine enregistré — `ai-devclassroom.com`,
      vérifié le 2026-11-07. Le relais et le panneau d'administration
      répondent tous les deux en production.
- [x] **Le sprint #1 est `ACTIVE`** depuis le 2026-11-05 : `Portfolio`,
      slug `portfolio`, 50 places, le 2026-12-05 de 08h30 à 17h30.
      ⚠ **Le prix bouge côté admin et le site suit sans broncher** :
      10 000 FCFA au relevé du 2026-11-07, **15 000 FCFA** (versement
      minimum 5 000) à celui du 2026-11-09. Ni l'un ni l'autre n'est le
      20 000 de l'affiche et de `CLAUDE.md`. Le site affiche ce que l'API
      dit (`edition.ts:83`) — c'est voulu, mais ça veut dire qu'une faute
      de frappe dans le panneau se retrouve en vitrine dans les quinze
      minutes (ISR, `revalider: 900`). **Le prix définitif est à acter
      avec Malik, puis à figer côté admin.**
- [x] **Le CORS n'est plus bloquant** — contourné, pas réglé. Le relais
      même-origine `src/app/api/[...chemin]/route.ts` fait passer les
      appels publics par le serveur Next, où la règle ne s'applique pas.
      Mesuré le 2026-11-07, `Access-Control-Allow-Origin` reste absent y
      compris pour `https://ai-devclassroom.com` : un appel direct depuis
      le navigateur échouerait toujours. Le relais tient, mais c'est un
      contournement — le jour où quelque chose doit parler à l'API sans
      passer par nous, il faudra la vraie liste blanche.
- [x] **lieu / ville / format** restent côté site, dans `FAITS_LOCAUX`
      (`edition.ts`). Acté : le modèle `Sprint` ne les porte pas.

### Reste à faire côté site

- [x] **Plus aucun marqueur de chantier sur le site public**
      (2026-11-09), sauf les deux compteurs de places qui attendent le
      champ de Youssouf. Règle posée : un trou de contenu ne s'affiche
      pas au visiteur. Soit l'élément ne se rend pas du tout (question de
      FAQ sans réponse, bio de formateur absente, description de session
      vide, ligne de liens jamais fournie — supprimée), soit il s'écrit
      en clair (« À annoncer » pour la date et le prix quand aucune
      session n'est ouverte ou que l'API est muette). Rien n'est inventé :
      les trous restent lisibles dans le code, aux endroits qui les
      déclarent (`QUESTIONS` dans `Faq.tsx`, `FORMATEURS`).
      ⚠ Conséquence à connaître : **le site ne signale plus ses propres
      trous.** La question « Dois-je venir avec mon ordinateur ? » a
      disparu de la FAQ, et la bio de Victorien n'apparaît nulle part.
      Elles reviendront d'elles-mêmes dès que le texte sera écrit.

- [ ] Décider ce qu'on fait du **paiement fractionné** : le sprint publié
      accepte des versements à partir de 3 000 FCFA (`minimumPaymentXof`),
      le site encaisse le prix entier d'un bloc. La page de retour sait
      déjà afficher un solde restant, au cas où.
- [ ] Le `trackingToken` ne vit que dans le `localStorage` du navigateur qui
      s'est inscrit. Stockage vidé, autre téléphone, navigation privée : il
      est perdu et le participant ne peut plus payer depuis le site. Le
      webhook Paystack met quand même le statut à jour, et la page de
      retour le dit au lieu d'afficher un échec — mais c'est un pansement.
      La vraie réponse est un lien de suivi par email, et elle appartient
      à l'API.
- [ ] **Mentions légales et politique de confidentialité.** Le site
      collecte nom, téléphone, email et passe par un prestataire de
      paiement. Le formulaire n'affiche pas de case de consentement, faute
      de page vers où pointer.

## Paiement

**Tranché hors de nos mains le 2026-10-28 : c'est Paystack**, parce que c'est
ce que l'API de Youssouf intègre. Montants entiers, devise `XOF`.

> L'analyse qui occupait cette section recommandait **CinetPay** pour la
> couverture mobile money ivoirienne (Orange Money, Wave, MTN MoMo, Moov) et
> écartait Stripe et PayPal. Elle n'a pas été contredite — elle a été
> doublée par un choix déjà implémenté. À vérifier auprès de Paystack :
> quels opérateurs mobile money sont réellement couverts en Côte d'Ivoire,
> les frais par transaction, et le délai de reversement.

### Le parcours, tel qu'il est branché

Depuis le 2026-10-28. Tout tient dans `src/lib/paiement.ts` et
`src/app/paiement/retour/`.

1. L'inscription réussit. On range le `trackingToken` sous
   `aidevsprint.suivi.<id>`.
2. L'écran de confirmation propose « Payer 20 000 FCFA ».
   `POST /payments/enrollments/:id/initialize`, jeton en en-tête
   `x-tracking-token`, corps `{ amountXof }`.
3. On range la trace sous `aidevsprint.paiement.<reference>` — **avant** de
   rediriger. Une fois l'onglet parti il n'y a plus de code à nous pour
   l'écrire, et Paystack ne renvoie que la référence : sans cette clé, la
   page de retour ne sait pas à quel dossier la rattacher.
4. Redirection vers `authorizationUrl`, après vérification que l'hôte est
   bien `paystack.com`.
5. Retour sur `/paiement/retour?reference=…` →
   `GET /payments/:reference/verify`, jeton en en-tête.

Le jeton ne passe **jamais** en paramètre d'adresse, bien que l'API
accepte `?trackingToken=` : une adresse se retrouve dans l'historique,
dans les journaux du serveur et dans le `Referer` de la page suivante.

Sept écrans de retour, tous vérifiés contre un faux back le 2026-10-28 :
réglé, réglé partiellement, en attente, échoué, référence absente,
référence sans jeton local, et les deux erreurs Paystack.

### Règle d'implémentation

Le statut d'une inscription ne devient jamais « payé » sur la foi d'une
redirection navigateur — **uniquement sur une vérification serveur**
(`GET /payments/:reference/verify`) ou un webhook signé. Une redirection se
falsifie, pas une signature HMAC. C'est aussi ce que dit la doc de l'API,
mot pour mot.

## Commandes

```bash
npm run dev      # http://localhost:3000
npm run build    # build de production — c'est AUSSI le vrai typecheck
npm start        # sert le build
```

Il n'y a plus de back à lancer : il tourne chez Youssouf. Pour vérifier
qu'il répond :

```bash
curl https://aidev.you-soft.com/api/v1/health
curl https://aidev.you-soft.com/api/v1/sprints
```

> `.env.local` doit porter
> `NEXT_PUBLIC_API_URL=https://aidev.you-soft.com/api/v1`. Sans elle, tout
> appel échoue franchement et le site le dit.

> `npx tsc --noEmit` seul échoue sur `LayoutProps` : ce type global est généré
> par Next dans `.next/types`. Le typecheck qui fait foi est celui de
> `npm run build`.

### Versions installées le 2026-10-15

| | |
|---|---|
| next | `16.4.2` |
| react / react-dom | `19.3.0` |
| typescript | `5.9.3` |
| tailwindcss | `4.3.3` |
| gsap | `3.15.0` |
| @gsap/react | `2.1.2` |
| lenis | `1.3.27` |

Échafaudé par `create-next-app` dans un dossier à part puis fusionné, pour
ne pas écraser `README.md`, `CLAUDE.md` ni le `.gitignore` existant.

`AGENTS.md` à la racine est généré et régénéré par `next dev` : il rappelle
que Next 16 a des ruptures d'API et qu'il faut lire
`node_modules/next/dist/docs/` avant de coder. Ne pas le supprimer.

## Conventions de code

- Nommage :
- Structure de `src/` :
- Gestion des erreurs :
- Ce qu'on ne fait pas :

## À décider

- [ ] Monorepo (`apps/web` + `apps/cms`) ou deux dépôts
- [x] **Hébergement front — réglé.** Le site est en ligne sur
      **`https://ai-devclassroom.com`**, servi depuis `212.47.73.163`,
      la même machine que `aidev.you-soft.com`. Mesuré le 2026-11-07 :
      la page d'accueil répond `200`, la date et l'heure affichées
      viennent bien de l'API, `/api/health` traverse le relais, et
      `/admin` redirige en `307` vers `/admin/connexion`.
- [ ] **Le déploiement Vercel `aidevsprint.vercel.app` est à débrancher
      ou à reconfigurer.** Il répond `200` mais son `/api/*` renvoie
      `NEXT_PUBLIC_API_URL n'est pas configurée` : `NEXT_PUBLIC_API_URL`
      n'y est pas posée. Deux adresses pour un seul site, dont une
      cassée — il faut en choisir une. Décision de Malik.
- [ ] Hébergement back (chez Youssouf, déjà en ligne — à acter)
- [ ] Stratégie de tests
- [ ] Gestionnaire de paquets (npm / pnpm)

## Décisions

Une ligne par décision structurante, la plus récente en haut.

- **2026-10-28** — **Back : l'API de Youssouf** (`aidev.you-soft.com`,
  NestJS + Prisma + PostgreSQL + Paystack). Le Laravel est supprimé : il
  n'était ni déployé ni payant, et deux back-ends pour une formation n'ont
  pas de sens. Conséquence : le paiement passe de CinetPay à **Paystack**,
  et ville / lieu / format / formateurs restent côté site, l'API n'ayant
  pas de champs pour eux.

- **2026-10-19** — ~~**Back : Laravel 13 + Filament 5, MySQL.**~~ — annulé le
  2026-10-28, voir ci-dessus. Strapi est
  abandonné et supprimé. Décision de Malik ; la raison n'est pas consignée, il
  ne l'a pas donnée. Le modèle de données (Édition, Formateur, Inscription)
  est conservé tel quel : il venait des types du front, pas de Strapi.
  Installé, migré, API vérifiée, 8 tests verts. Aucun compte d'admin, aucune
  édition publiée. Voir [Backend](#backend--laravel).
- **2026-10-19** — ~~Strapi 5.58 installé dans `backend/`, SQLite, trois types de
  contenu, permissions en code, API vérifiée~~ — annulé le jour même, voir
  ci-dessus. Le travail est dans le commit `739beea` si besoin de le relire.
- **2026-10-15** — **Design system figé** depuis l'affiche : couleurs mesurées
  au pixel, Inter + JetBrains Mono, aucune ombre, dégradé signature limité à
  4 emplacements. Voir [design.md](design.md#tokens).
- **2026-10-15** — ~~Back : Strapi (le brief disait Laravel, arbitré ici)~~ —
  annulé le 2026-10-19, retour à Laravel. **Framer Motion écarté**, GSAP + Lenis
  seuls — celle-là tient toujours.
- **2026-10-06** — Site **évolutif** (éditions, portfolios, blog) + **inscription
  et paiement en ligne**. Un back-office devient nécessaire ; paiement par
  mobile money, CinetPay proposé.
- **2026-10-06** — **Back reporté.** Strapi n'est plus acté : candidats
  Strapi / Payload / Laravel, départagés par la portabilité du back-office.
  Le front avance sans attendre.
- **2026-10-06** — **Puissance avant économie de tokens.** Aucun skill n'est
  élagué ; le coût (~3 340 tokens de descriptions par session) est assumé.
  Contrepartie obligatoire : [règle de préséance](design.md#règle-de-préséance).
- **2026-10-06** — Graphify installé puis **retiré le jour même** : confiance
  insuffisante. Skill et paquet désinstallés. À ne pas réintroduire sans
  décision explicite.
- **2026-10-06** — Skills `emilkowalski/skills` installés dans `.claude/skills/`
  (commit `e8a175d`, MIT). Conflits recensés dans [design.md](design.md#arbitrages-avec-les-skills-installés).
- **2026-10-06** — Grand écran : contenu cadré à 120rem, marges en %, plafond
  uniquement sur la longueur de ligne (70–75ch). Voir [design.md](design.md#pas-de-marges-mortes-sur-grand-écran).
- **2026-10-05** — TypeScript + Tailwind CSS 4. Conséquence : variante React Bits `TS-TW`.
- **2026-10-05** — ~~Back : Strapi 5~~ — annulé le 2026-10-06, voir ci-dessus.
- **2026-10-05** — Front : Next.js 16 + GSAP + Lenis + React Bits (copie de composants).
- **2026-10-05** — Structure du projet posée (CLAUDE.md + docs/ + design/ + src/).

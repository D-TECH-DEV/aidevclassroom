# aidevsprint

Site de **AIdevsprint**, une formation d'une journée à Yamoussoukro qui apprend
à guider l'IA avec de vraies compétences de dev. Le participant repart avec son
portfolio en ligne.

**Le site a un seul job : remplir les places.** Tout le reste est secondaire.

> ⚠️ Rédigé à partir de l'affiche dans `design/`. À confirmer par Malik.

## Le produit

| | |
|---|---|
| Format | Formation, 1 journée |
| Lieu | Yamoussoukro |
| Date | à venir |
| Niveau requis | bases en dev |
| Prix | 20 000 FCFA |
| Promesse | « Repars avec ton portfolio en ligne » |
| Accroche | « Le vibe coding, bien fait » |
| Réservation | ai-devclassroom.com · WhatsApp 07 04 92 10 80 |

**Le programme, en 4 temps :**

1. Le design de ton site
2. Le code, en guidant l'IA
3. Ton admin + ton chatbot IA
4. Ton site déployé en ligne

**Les intervenants :**

- **Victorien** — machine learning
- **Youssouf Doumje** — dev full stack & DevOps
- **Abdel Malik** — dev full stack

## Nature du site — décidé le 2026-10-06

**Un site qui vivra**, pas une landing jetable. Plusieurs éditions avec leurs
dates, des portfolios d'anciens participants, peut-être un blog. Le contenu
doit changer sans toucher au code.

**La réservation et le paiement se font sur le site.** Formulaire
d'inscription + encaissement des 20 000 FCFA en ligne.

Trois conséquences directes :

1. **Un back-office est nécessaire** — pour les éditions, les inscriptions et
   les paiements. Les données et les règles sont chez Youssouf, le site ne
   fait que consommer son API. Mais son API n'avait aucune interface : le
   panneau `/admin` du site est cette interface depuis le 2026-11-02. Voir
   [docs/admin.md](docs/admin.md) et
   [docs/stack.md](docs/stack.md#backend--lapi-aidev-classroom).
2. **Le paiement passe par Paystack**, intégré dans l'API et branché côté
   site depuis le 2026-10-28 : l'écran de confirmation redirige vers
   Paystack et `/paiement/retour` vérifie auprès du serveur. Reste à
   régler `PAYSTACK_CALLBACK_URL` côté Youssouf. Voir
   [docs/stack.md](docs/stack.md#paiement).
3. **Des données personnelles sont collectées** — nom, contact, paiement.
   Mentions légales, politique de confidentialité et sécurisation des
   données ne sont pas optionnels.

### Reste à préciser

- [ ] Quelles entités exactement : Édition, Inscription, Intervenant,
      Portfolio, Article ?
- [ ] Le portfolio d'un ancien est-il hébergé ici, ou juste un lien externe ?
- [ ] Que se passe-t-il après paiement : email, WhatsApp, billet ?
- [ ] Places limitées ? Si oui, combien, et que montre le site une fois plein ?

**Statut :** design system figé depuis l'affiche. Rien n'est encore installé.

**Stack :** Next.js 16 · TypeScript · Tailwind 4 · GSAP + Lenis · React Bits (`TS-TW`).
Back : **l'API de Youssouf** (`aidev.you-soft.com`, NestJS + Paystack) —
voir [docs/stack.md](docs/stack.md#backend--lapi-aidev-classroom).
Détail et points ouverts dans [docs/stack.md](docs/stack.md).

## Docs

La doc longue vit dans `docs/`. Ce fichier ne fait que pointer dessus.

- [docs/stack.md](docs/stack.md) — stack technique, commandes, conventions de code
- [docs/admin.md](docs/admin.md) — le panneau d'administration : écrans, sécurité, pièges
- [docs/demandes-api.md](docs/demandes-api.md) — ce que le site attend de l'API, à transmettre à Youssouf
- [docs/pour-youssouf.md](docs/pour-youssouf.md) — le relevé du 2 novembre, périmé, gardé pour l'historique
- [docs/design.md](docs/design.md) — direction artistique, tokens, composants
- [.claude/skills/README.md](.claude/skills/README.md) — skills installés et leurs limites

## Arborescence

```
.
├── CLAUDE.md          # ce fichier : résumé + liens
├── .claude/skills/    # skills du projet, un dossier chacun
├── docs/              # doc longue (stack, design, décisions)
├── design/            # fichiers .pen (pen.dev)
└── src/               # code
```

## Règles de travail

- **Le site se construit section par section.** Proposer la structure, les
  paliers et les effets de survol → attendre validation → coder → valider.
- **Rien de décoratif sans accord** : ni ombre, ni dégradé, ni flou, ni hover
  par défaut. Tout composant supplémentaire (carrousel, onglets…) se propose
  avant d'exister.
- **L'échelle prime** : tout se redimensionne (texte, cartes, boutons,
  espacements), en `rem` et `%`. Pas de bandes vides sur grand écran, pas
  d'étirement non plus. Règles complètes :
  [docs/design.md](docs/design.md#règles-non-négociables).
- **Mobile = réduire, pas empiler.** Retirer un élément ou désactiver une
  animation sur petit écran demande ton accord d'abord — jamais en silence.
- Lire le doc concerné dans `docs/` avant de toucher au code lié.
- Les `.pen` de `design/` sont chiffrés : y accéder **uniquement** via les outils
  MCP `pencil` (`get_app_state`, `execute`, `get_style`), jamais en lecture brute.
- Toute décision structurante va dans `docs/`, pas seulement dans un commit.

## Commandes

Voir [docs/stack.md](docs/stack.md#commandes) — à remplir quand la stack est posée.

# Skills du projet

Un dossier par skill, le nom du dossier = le nom du skill (kebab-case).
Chaque dossier contient au minimum un `SKILL.md` avec un frontmatter :

```markdown
---
name: mon-skill
description: Quand déclencher ce skill, en une ligne, avec les mots que l'utilisateur emploierait.
---

Les instructions à suivre.
```

- `description` est ce qui décide si le skill se déclenche : écrire les
  déclencheurs réels, pas une définition abstraite.
- Fichiers lourds (références, scripts, templates) dans des sous-dossiers,
  référencés depuis `SKILL.md` — ils ne sont lus qu'au besoin.
- Invocable à la main par `/mon-skill`.

Voir `exemple-skill/` pour la forme.

## Skills installés

### emilkowalski/skills

Source : <https://github.com/emilkowalski/skills> — commit `e8a175d` (2026-10-02),
licence MIT (copie dans `LICENSE-emilkowalski`). Auteur : Emil Kowalski
(Sonner, Vaul ; ex-Vercel, ex-Linear).

Installés par copie, pas en dépendance : `npx skills@latest add emilkowalski/skills`
est la voie officielle, mais on garde les fichiers dans le dépôt pour pouvoir
les amender (voir les arbitrages dans
[docs/design.md](../../docs/design.md#arbitrages-avec-les-skills-installés)).

| Skill | Utile ici |
|-------|-----------|
| `emil-design-eng` | oui — skill principal : easings, durées, états |
| `animate` | oui — construire une animation, choix de l'outil |
| `review-animations` | oui — relecture stricte (invocation explicite) |
| `improve-animations` | oui — audit de la base de code |
| `find-animation-opportunities` | oui — où animer, et surtout où ne pas |
| `animation-vocabulary` | oui — nommer un effet pour le demander précisément |
| `apple-design` | partiel — voir arbitrages (ombres, matières translucides) |
| `mobile-native` | oui — 100vh, tap highlight, safe areas, zoom des inputs |
| `break-ui` | oui — tester avec des données pires cas |
| `prototype` | oui — plusieurs variantes derrière un sélecteur |
| `pick-ui-library` | à surveiller — peut proposer autre chose que React Bits |
| `ask-sonner` | seulement si on ajoute Sonner |
| `animate-expo` | **hors sujet** (React Native) |
| `write-swift` | **hors sujet** (Swift) |

Trois skills ne se déclenchent que sur appel explicite
(`disable-model-invocation`) : `pick-ui-library`, `prototype`,
`review-animations`.

### Skills globaux utilisés par ce projet

Installés dans `~/.claude/skills/`, donc pas dupliqués ici :

- **`design-dna`** — extraction et application de DNA de design à partir de
  références visuelles.

### Politique

**La puissance avant l'économie de tokens** (2026-10-06). On garde tous les
skills, y compris ceux dont les avis se contredisent. En échange, la
[règle de préséance](../../docs/design.md#règle-de-préséance) est stricte :
`docs/design.md` gagne sur tout skill.

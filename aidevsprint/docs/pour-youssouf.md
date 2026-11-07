# Pour Youssouf — où le site est branché, et ce qui le bloque

> ⚠️ **Document largement périmé, conservé pour l'historique.**
>
> Il a été écrit les 1er et 2 novembre 2026, quand le site n'était hébergé
> nulle part et qu'aucun sprint n'existait. Depuis, Youssouf a lu ce
> document et réglé l'essentiel : le site est en ligne sur
> `ai-devclassroom.com`, le sprint #1 est `ACTIVE`, et le CORS est
> contourné par un relais même-origine qu'il a écrit lui-même
> (`src/app/api/[...chemin]/route.ts`).
>
> **Ce qui reste à faire est tenu à jour dans
> [stack.md](./stack.md#ce-que-youssouf-doit-faire-de-son-côté)** — pas
> ici. Les mesures ci-dessous décrivent l'état du 2 novembre, plus celui
> d'aujourd'hui.
>
> Un point du § 1 reste vrai au 2026-11-07 : `Access-Control-Allow-Origin`
> n'est toujours renvoyé pour aucune origine, `ai-devclassroom.com`
> comprise. Ça ne bloque plus rien grâce au relais, mais ce n'est pas
> réglé pour autant.

Salut Youssouf.

Tu dis que tu ne vois pas où le site est connecté. **C'est exact, et c'est
normal** — ce document explique pourquoi, et ce qu'il faut pour que tu le
voies.

---

## En résumé

| # | Quoi | Chez qui | Bloquant ? |
|---|---|---|---|
| 1 | `Access-Control-Allow-Origin` absent | toi | **oui, totalement** |
| 2 | Aucun sprint `ACTIVE` en base | toi | oui |
| 3 | `GET /enrollments/:id/status` → 500 | toi | non, mais à réparer |
| 4 | `PAYSTACK_CALLBACK_URL` | toi | pas encore — voir § 4 |
| 5 | Le site n'est hébergé nulle part | nous | oui, on s'en occupe |

**Ton API, elle, est bonne.** On a sondé les 31 routes de ta doc une par une :
toutes répondent, aucune en 404. Auth, étudiants, sprints, inscriptions,
paiements, webhook, dashboard — tout est debout, et `/health` confirme que la
base aussi. Il n'y a rien à développer. Ce qui reste, c'est de la
configuration.

---

## Pourquoi tu ne vois rien

Deux raisons qui se cumulent.

**1. Brancher un site sur une API ne laisse aucune trace côté serveur.**

Il n'y a pas de déclaration à faire, pas de clé à enregistrer, pas de case à
cocher dans ton admin. Ton back ne découvre l'existence du site qu'à la
seconde où un appel aboutit. Tant qu'aucun appel n'aboutit, pour toi, le site
n'existe pas. Tu cherches un branchement visible : il n'y en a pas, et il n'y
en aura jamais. Ce qui se voit, c'est le résultat — une inscription qui tombe
dans ta base.

**2. Aucun appel n'aboutit, à cause du CORS.**

Et c'est le piège : le navigateur envoie d'abord une requête `OPTIONS` de
contrôle. Il voit qu'il manque un en-tête, et **il n'envoie jamais le vrai
`POST`**. Ta base reste donc vide, tes inscriptions à zéro, et tu en conclus
logiquement que rien n'est branché.

**Tu peux le vérifier tout de suite :** ouvre les logs de ton serveur et
cherche les `OPTIONS /api/v1/enrollments`. Elles y sont. C'est le site qui
frappe à la porte et se fait refouler avant d'entrer.

En `curl`, tout passe — `curl` ne fait pas de CORS, c'est une règle de
navigateur uniquement. D'où l'impression que tout va bien de ton côté.

---

## 1. Le CORS — le seul vrai blocage

### Ce qu'on mesure

```bash
curl -s -D - -o /dev/null -X OPTIONS \
  "https://aidev.you-soft.com/api/v1/enrollments" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,x-tracking-token"
```

Réponse, aujourd'hui :

```
HTTP/1.1 204 No Content
Vary: Origin, Access-Control-Request-Headers
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
Access-Control-Allow-Headers: content-type,x-tracking-token
```

Quatre en-têtes sur cinq sont là. **Il manque `Access-Control-Allow-Origin`**,
et c'est le seul qui compte : sans lui le navigateur jette la réponse, les
autres ne servent à rien.

À noter : ça a bougé depuis le 27 octobre. `Vary`, `Allow-Credentials`,
`Allow-Methods` et `Allow-Headers` sont apparus — tu as donc bien touché à la
config. Mais pas celui-là.

### Le diagnostic

On a testé cinq origines :

```
http://localhost:3000             → AUCUN Allow-Origin
https://ai-dev-sprint.com         → AUCUN Allow-Origin
https://aidevsprint.vercel.app    → AUCUN Allow-Origin
https://aidev.you-soft.com        → AUCUN Allow-Origin   ← ta propre origine
https://nimporte-quoi.test        → AUCUN Allow-Origin
```

**Même ta propre origine est refusée, et une origine inventée aussi.** Ce n'est
donc pas une liste blanche trop stricte : c'est une liste blanche **qui ne
correspond à rien**. Autrement dit, `enableCors({ origin: … })` reçoit une
valeur vide — très probablement `FRONTEND_URL` non définie ou mal nommée dans
l'environnement de production.

Le CORS est **activé** chez toi. Il est juste alimenté par une variable vide.

### Deux pièges à éviter

**`*` ne marchera pas.** Tu renvoies `Access-Control-Allow-Credentials: true`,
et la spec interdit de combiner le joker avec les credentials — le navigateur
refusera quand même. Il faut **renvoyer l'origine exacte** de la requête,
après l'avoir vérifiée contre ta liste.

**Pense au port en développement.** `http://localhost:3000` et
`https://localhost:3000` sont deux origines différentes, et une origine ne
contient jamais de `/` final.

### Ce qu'on te demande d'autoriser

```
http://localhost:3000       ← pour qu'on puisse tester et te montrer
<l'URL de production>       ← on te la donne dès que le site est hébergé
```

### Comment vérifier que c'est réglé

La même commande que plus haut doit faire apparaître la ligne :

```
Access-Control-Allow-Origin: http://localhost:3000
```

Si tu la vois, c'est gagné.

---

## 2. Aucun sprint `ACTIVE`

```bash
curl -s "https://aidev.you-soft.com/api/v1/sprints"
```

```json
{"data":{"items":[],"total":0,"page":1,"limit":20},"meta":{}}
```

La base est vide. Le site lit cette route pour afficher la date, le prix et
les places restantes. Tant qu'elle renvoie `[]`, il n'a aucune information à
montrer et la modale d'inscription annonce que les inscriptions ne sont pas
ouvertes.

**Il faut créer le sprint #1 et le passer `ACTIVE`.**

Un détail qui compte : **le nom du sprint s'affiche tel quel** dans
l'étiquette de la section Session, sur le site public. À nommer en
conséquence.

Deux questions ouvertes là-dessus :

- **Un compteur d'inscrits sur la route publique ?** Sans lui, la jauge de
  places reste vide. On ne veut pas taper les routes `/admin` depuis le site
  public, évidemment.
- **`lieu`, `ville`, `format` dans le modèle `Sprint` ?** Ou on acte qu'ils
  restent écrits en dur côté site. Les deux nous vont, il faut juste trancher.

---

## 3. Un bug : `GET /enrollments/:id/status` renvoie toujours 500

```bash
curl -s "https://aidev.you-soft.com/api/v1/enrollments/1/status"
curl -s "https://aidev.you-soft.com/api/v1/enrollments/1/status" -H "x-tracking-token: bidon"
curl -s "https://aidev.you-soft.com/api/v1/enrollments/999999/status" -H "x-tracking-token: bidon"
```

Les trois renvoient la même chose :

```json
{"statusCode":500,"code":"INTERNAL_ERROR","message":"Erreur interne du serveur."}
```

Ta doc annonce `401 TRACKING_TOKEN_REQUIRED` sans jeton,
`401 TRACKING_TOKEN_INVALID` avec un mauvais jeton, et
`404 ENROLLMENT_NOT_FOUND` sur un identifiant inconnu. On n'obtient aucun des
trois : le `TrackingTokenGuard` semble planter avant même de décider.

**Ce n'est pas bloquant** — le site ne consomme pas cette route aujourd'hui.
Mais c'est celle qui permettrait à un participant de retrouver son dossier, et
elle nous sera nécessaire le jour où on enverra un lien de suivi par email.
Autant la réparer tant qu'on y est.

---

## 4. `PAYSTACK_CALLBACK_URL` — pas tout de suite

C'était sur notre liste, on le retire temporairement : **le domaine
`ai-dev-sprint.com` n'est pas encore enregistré.**

```
$ nslookup ai-dev-sprint.com 8.8.8.8
*** ai-dev-sprint.com : Non-existent domain
```

Inutile de pointer le callback vers une adresse qui n'existe pas. On te donne
l'URL définitive dès que l'hébergement est en place.

Pour mémoire, quand ce sera le moment, l'enjeu est sérieux : si le callback ne
pointe pas sur notre page de retour, le participant paie et atterrit ailleurs.
**L'argent part, la confirmation non.**

La page, elle, existe déjà et attend : `/paiement/retour`.

---

## 5. De notre côté : l'hébergement

Pour être honnête sur la répartition, voilà notre part du retard.

Le code est sur GitHub, à jour, et il compile sans erreur. Mais **le site
n'est hébergé nulle part** — il ne tourne que sur la machine de Malik. Le
domaine n'est pas pris non plus. C'est pour ça que tu n'as aucune URL à
ouvrir.

On s'en occupe. Dès qu'il y a une URL publique, on te la transmet pour que tu
l'ajoutes à la liste blanche.

**Mais tu n'as pas besoin de nous attendre :** autorise `http://localhost:3000`
dès maintenant, et on peut te faire la démonstration aujourd'hui (voir plus
bas).

---

## Ce que le site appelle, exactement

Quatre routes, pas une de plus. Aucune route `/admin` n'est touchée depuis le
site public.

| Route | Quand | Pourquoi |
|---|---|---|
| `GET /sprints?page=1&limit=1` | au chargement | date, prix, places |
| `POST /enrollments` | validation du formulaire | crée l'inscription, récupère le `trackingToken` |
| `POST /payments/enrollments/:id/initialize` | clic sur « Payer » | récupère l'`authorizationUrl` Paystack |
| `GET /payments/:reference/verify` | retour de Paystack | **le statut qui fait foi** |

Trois choses sur la façon dont on s'en sert, pour que tu saches à quoi
t'attendre :

**On ne croit jamais une redirection.** Un retour navigateur ne prouve aucun
paiement — l'adresse se bricole à la main. On n'affiche « c'est réglé » que si
`verify` le dit. C'est aussi ce que ta doc recommande, mot pour mot.

**Le `trackingToken` part en en-tête, jamais en paramètre d'URL.** Ton API
accepte `?trackingToken=`, mais une URL se retrouve dans l'historique du
navigateur, dans les logs serveur et dans le `Referer` de la page suivante. Un
jeton qui tient lieu de mot de passe n'a rien à y faire. On utilise
`x-tracking-token`.

**On gère le paiement partiel**, au cas où. Le site encaisse 20 000 FCFA d'un
bloc, mais la page de retour sait afficher un solde restant si `verify` en
renvoie un.

---

## La démonstration, en cinq minutes

Quand tu veux, et sans attendre l'hébergement ni le domaine :

1. **Tu ajoutes `http://localhost:3000`** à la liste blanche CORS.
2. **Tu nous le dis.**
3. On lance le site en local et on remplit le formulaire avec un faux
   participant.
4. **L'inscription apparaît dans ton admin**, en direct, sous tes yeux.

C'est le seul moyen de « voir » la connexion — par son résultat. Et ça
validera d'un coup les quatre routes, le jeton de suivi et l'enchaînement
jusqu'à Paystack.

---

## Une dernière question

**Est-ce qu'un email part à l'inscription ?** Rien dans ta doc n'en parle,
donc par prudence le site ne promet aucun email au participant. Si ton back en
envoie un, on peut l'annoncer à l'écran — c'est rassurant pour quelqu'un qui
vient de payer 20 000 FCFA. Si ce n'est pas prévu, il faudra en parler :
aujourd'hui, un participant qui perd son navigateur perd l'accès à son
dossier, et c'est notre point faible connu.

---

*Document maintenu dans le dépôt du site : `docs/pour-youssouf.md`. Les
décisions d'intégration côté site sont dans `docs/stack.md`.*

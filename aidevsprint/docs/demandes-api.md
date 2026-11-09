# Ce que le site demande à l'API

> Relevé du **2026-11-09**, mesuré de l'extérieur contre
> `https://aidev.you-soft.com/api/v1`. Chaque ligne porte la commande qui
> la prouve : lance-la, tu verras la même chose.
>
> Pour l'historique (le CORS, le domaine qui n'existait pas), voir
> [pour-youssouf.md](./pour-youssouf.md) — périmé, gardé pour la trace.

Quatre demandes, dans l'ordre de ce qu'elles coûtent au site. Les deux
premières se voient par le visiteur, les deux autres non.

---

## 1. Un compteur d'inscrits sur la route publique — **bloquant**

C'est la seule chose qui manque pour que le site n'affiche plus aucun
`[À DÉTERMINER]`. Le marqueur apparaît deux fois, aux deux endroits qui
vendent l'urgence : la pastille du hero et la barre d'action mobile.

`GET /sprints` donne la capacité, jamais le remplissage :

```
$ curl -s https://aidev.you-soft.com/api/v1/sprints/1
{"id":1,"name":"Portfolio", ... "capacity":50,"status":"ACTIVE"}
```

Aucune route publique ne le porte ailleurs — six chemins plausibles
essayés, les six répondent `404` :

```
GET /enrollments?sprintId=1   404      GET /sprints/1/seats          404
GET /enrollments              404      GET /sprints/1/availability   404
GET /sprints/1/enrollments    404      GET /sprints/1/stats          404
```

Le décompte n'existe que derrière `/admin`, donc derrière le JWT — qui
ne doit jamais atteindre le navigateur. Sans ce champ, le site ne peut
pas écrire « il reste N places » sans l'inventer, et il ne l'inventera
pas.

**Demandé :** un entier sur le `Sprint` public, par exemple
`enrolledCount`, à côté de `capacity`. Rien d'autre — surtout pas la
liste des inscrits, qui est de la donnée personnelle et n'a rien à faire
sur une route publique.

**⚠ Une question à trancher avant de coder, et c'est à Malik :** une
inscription `PENDING` non payée compte-t-elle une place ? Si oui, un
visiteur qui ouvre le formulaire et abandonne fait baisser le compteur
pour tout le monde. Si non, le sprint peut se retrouver survendu. Les
deux se défendent, mais il faut choisir — ne pas deviner.

Côté site, tout est déjà branché : il suffira de remplir `inscrits` dans
`src/lib/edition.ts` (une ligne), la jauge et la barre mobile se
rempliront toutes seules.

---

## 2. `GET /enrollments/:id/status` renvoie 500 — **cassé**

Mesuré le 2026-11-01, toujours vrai le 2026-11-09. La route plante dans
tous les cas de figure, y compris sur un identifiant qui n'existe pas :

```
$ curl -s https://aidev.you-soft.com/api/v1/enrollments/1/status
{"statusCode":500,"code":"INTERNAL_ERROR","message":"Erreur interne du serveur."}

$ curl -s https://aidev.you-soft.com/api/v1/enrollments/999999/status
{"statusCode":500,"code":"INTERNAL_ERROR","message":"Erreur interne du serveur."}
```

La doc annonce `401 TRACKING_TOKEN_REQUIRED` sans jeton et
`404 ENROLLMENT_NOT_FOUND` sur un identifiant inconnu. On n'obtient ni
l'un ni l'autre : le garde plante avant de décider. Un `404` qui devient
`500`, c'est en général une exception non rattrapée dans le guard.

Le site ne consomme pas cette route aujourd'hui, donc **rien n'est
bloqué** — mais c'est elle qui permettrait au participant de retrouver
son dossier et de finir de payer. Voir la demande 4.

---

## 3. `PAYSTACK_CALLBACK_URL` — à confirmer, invérifiable d'ici

Elle doit pointer sur :

```
https://ai-devclassroom.com/paiement/retour
```

C'est une variable d'environnement de ton côté, invisible de l'extérieur :
personne ici ne peut vérifier qu'elle est bonne. Tant qu'elle pointe
ailleurs, le participant paie et atterrit dans le vide — **l'argent part,
la confirmation non.** Un simple « c'est bien ça » suffit.

Le domaine a changé en cours de route : `ai-dev-sprint.com` n'a jamais
été pris, c'est `ai-devclassroom.com` partout maintenant.

---

## 4. Retrouver son dossier sans le `trackingToken` — manquant

Aujourd'hui le `trackingToken` ne vit que dans le `localStorage` du
navigateur qui s'est inscrit. Stockage vidé, autre téléphone, navigation
privée : il est perdu, et le participant ne peut plus payer depuis le
site. Le webhook Paystack met quand même le statut à jour, donc l'argent
déjà versé n'est pas perdu — mais la personne, elle, est coincée.

Deux façons de régler ça, au choix :

- **un email à l'inscription**, contenant le lien de suivi avec le
  jeton. C'est la solution propre, et elle répond aussi à la question
  ci-dessous ;
- **une route de récupération** par email + identifiant de sprint, qui
  renvoie le jeton. Plus simple à écrire, mais c'est une route qui rend
  un secret à qui connaît une adresse email — il lui faudrait au minimum
  une limitation de débit.

**Question ouverte, et elle est pour toi :** est-ce qu'il part un email
à l'inscription aujourd'hui ? Rien dans la doc n'en parle, donc le site
n'en promet aucun — l'écran de confirmation ne dit pas « tu vas recevoir
un email », faute de savoir.

---

## Pas bloquant, mais à savoir

### Le CORS n'est pas réglé, il est contourné

```
$ curl -s -D - -o /dev/null -X OPTIONS \
    https://aidev.you-soft.com/api/v1/sprints \
    -H "Origin: https://ai-devclassroom.com" \
    -H "Access-Control-Request-Method: POST"

HTTP/1.1 204 No Content
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
Access-Control-Allow-Headers: content-type,x-tracking-token
```

Tout est là **sauf `Access-Control-Allow-Origin`**, y compris pour notre
propre domaine. Un appel direct depuis le navigateur échouerait encore.
Ça ne bloque plus rien parce que les appels publics passent par le relais
même-origine du site (`src/app/api/[...chemin]/route.ts`), où la règle
ne s'applique pas. Mais c'est un contournement : le jour où quelque
chose doit parler à l'API sans passer par nous — une app mobile, un
script, un autre front — il faudra la vraie liste blanche.

À noter : `Access-Control-Allow-Credentials: true` interdit de répondre
`*`. Il faut une liste explicite d'origines.

### Le `Sprint` ne porte ni ville, ni lieu, ni format

Le modèle a été écrit pour des sprints de plusieurs semaines, pas pour
une journée dans une salle précise. Ces trois faits sont donc tenus côté
site, en dur, dans `FAITS_LOCAUX` (`src/lib/edition.ts`).

Ça tient tant qu'il n'y a qu'une ville. Le jour où une édition se tient
ailleurs qu'à Yamoussoukro, le site affichera la mauvaise adresse sans
prévenir. **Pas urgent, mais c'est une dette qui a une date
d'expiration.**

### Le prix bouge, et le site suit sans broncher

Relevé trois fois, trois valeurs : 10 000 FCFA le 2026-11-07, 15 000 le
2026-11-09 (versement minimum passé de 3 000 à 5 000). L'affiche, elle,
dit 20 000.

Le site affiche ce que l'API dit — c'est voulu, c'est tout l'intérêt du
back-office. Mais ça veut dire qu'une faute de frappe dans le panneau est
en vitrine dans les quinze minutes (ISR, `revalider: 900`). **Le prix
définitif est à acter avec Malik, puis à ne plus toucher.**

---

## Plus tard, quand le site vivra

Pas des demandes, juste de quoi anticiper. Le site est prévu pour durer
au-delà de l'édition #1 : plusieurs éditions, les portfolios des anciens
participants, peut-être un blog. Les entités `Portfolio` et `Article`
n'existent nulle part aujourd'hui et personne n'a encore décidé si elles
vivent chez toi ou ailleurs. À voir ensemble avant que quelqu'un commence.

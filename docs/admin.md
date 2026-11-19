# Le panneau d'administration

> Créé le 2026-11-02, à la demande de Malik. L'API de Youssouf expose
> treize routes `/admin` protégées par JWT, mais **aucune interface** ne les
> utilisait : pour voir une inscription il fallait taper une commande
> `curl` avec un jeton. Ce panneau est cette interface.

Adresse : `/admin`. Pas de lien depuis le site public, `noindex` partout.

## Les quatre écrans

| Adresse | Ce qu'on y fait |
|---|---|
| `/admin/connexion` | se connecter avec un compte `ADMIN` de l'API |
| `/admin` | encaissé, reste à encaisser, inscriptions, participants, sessions actives, paiements en attente, et les dix derniers de chaque liste |
| `/admin/inscriptions` | la liste, filtrable par statut et par nom ; une fiche par inscription |
| `/admin/paiements` | tous les versements, filtrables par statut et par référence |

La fiche d'une inscription porte ses paiements, ses soldes, le contact du
participant, et les boutons de changement de statut.

## La décision structurante : tout passe par le serveur

**Aucun appel à l'API ne part du navigateur.** C'est le serveur Next qui
appelle `aidev.you-soft.com`, et le navigateur ne parle qu'à Next.

Deux raisons, dans cet ordre d'importance.

**Le jeton ne doit pas être lisible.** Le JWT d'administration ouvre tout le
back-office — inscriptions, paiements, création d'administrateurs. Rangé
dans le `localStorage`, il serait lisible par n'importe quel script de la
page : une dépendance compromise, une extension, une faille XSS, et il
part. Ici il vit dans un cookie `httpOnly`, que même notre propre
JavaScript ne peut pas lire.

**Et accessoirement, ça contourne le CORS.** Le CORS est une règle de
navigateur. Comme c'est le serveur qui appelle, elle ne s'applique pas :
**le panneau fonctionne dès maintenant**, sans attendre que Youssouf ouvre
son `Access-Control-Allow-Origin`. Le site public, lui, reste bloqué — voir
[pour-youssouf.md](./pour-youssouf.md).

## Le cookie

| | |
|---|---|
| Nom | `aidevsprint_admin` |
| Contenu | le JWT rendu par `POST /auth/login` |
| `httpOnly` | oui — illisible en JavaScript |
| `secure` | en production seulement (sinon `localhost` en clair ne marcherait pas) |
| `sameSite` | `lax` — aucune requête inter-site n'en a besoin |
| `path` | `/admin` — il ne part jamais avec une requête du site public |
| Durée | celle qu'annonce l'API (`expiresIn`, défaut `1h`) |

L'API ne sait ni rafraîchir ni révoquer un jeton, et n'a pas de route de
déconnexion : c'est écrit dans sa doc. Le cookie expire donc avec le jeton,
et « se déconnecter » veut dire effacer le cookie. Au-delà d'une heure, il
faut se reconnecter.

## Ce qui protège, et ce qui ne protège pas

**La frontière de sécurité est l'API.** Chaque route `/admin` exige un JWT
`ADMIN` valide et vérifie à chaque requête que le compte est toujours
actif. Le panneau n'affiche que ce qu'elle accepte de donner.

`src/proxy.ts` ne vérifie que la **présence** du cookie, jamais sa
signature — ça demanderait la clé de l'API, que nous n'avons pas et ne
devons pas avoir. Un cookie bricolé franchit donc cette porte, et se fait
refuser à la requête suivante : l'API renvoie `401`, et le panneau ramène à
la connexion. Vérifié le 2026-11-02.

Le panneau refuse en plus de poser le cookie si `admin.role !== "ADMIN"`,
même quand l'API accepte la connexion. Ceinture et bretelles.

## Trois pièges de `cacheComponents`, et leurs corrections

Ce projet active `cacheComponents`. Trois comportements en découlent, tous
rencontrés et corrigés le 2026-11-02 — à relire avant d'ajouter un écran.

**1. `cookies()` lu deux fois dans la même requête lève un invariant.**
Après une action serveur, Next re-rend la page : le cookie est consulté une
fois dans le contexte de l'action, une fois dans celui du rendu. Next
compare les deux et lève
`InvariantError: Received an underlying cookies object that does not match…`.
`litSession` est donc enveloppé dans `cache()` de React — pas pour la
vitesse, pour la correction. Un seul accès par requête, plus de
comparaison. Symptôme trompeur si on l'ignore : l'écran reste bloqué sur
« Chargement… » et **aucun message d'erreur n'apparaît**, parce que
l'invariant casse le flux avant que le bloc d'erreur ne soit rendu.

**2. `redirect()` dans un composant dynamique ne marche pas sans
JavaScript.** La coquille est servie statiquement et la redirection part
dans le flux RSC : c'est le navigateur qui l'exécute. La garde
d'authentification est donc dans `src/proxy.ts`, qui émet un vrai `307`
HTTP avant tout rendu.

**3. `notFound()` a exactement le même défaut.** La fiche d'inscription
rend donc son propre bloc « introuvable » comme du contenu ordinaire,
plutôt que d'appeler `notFound()`.

Au passage : le fichier s'appelle `proxy.ts` et non `middleware.ts` —
Next 16 a renommé la convention, l'ancien nom affiche un avertissement de
dépréciation.

## Ce que le panneau sait écrire

Deux choses seulement, les deux documentées par l'API.

**Changer le statut d'une inscription.** Les boutons n'affichent que les
transitions que l'API accepte depuis l'état courant
(`PENDING → CONFIRMED | CANCELLED`, `CONFIRMED → COMPLETED | CANCELLED`,
les deux autres états sont définitifs). `COMPLETED` est masqué tant que le
solde n'est pas à zéro, parce que l'API le refuserait
(`ENROLLMENT_NOT_SETTLED`). Proposer un bouton qui mène à une erreur est
une promesse en l'air.

**Revérifier un paiement.** `POST /admin/payments/:id/recheck` redemande
son avis à Paystack. C'est le rattrapage quand un webhook se perd : le
paiement est encaissé chez Paystack mais reste `PENDING` chez nous, et la
place paraît impayée. Le bouton n'apparaît que sur les `PENDING` —
relancer un `SUCCESS` ne changerait rien.

Tout le reste est en lecture. Le panneau ne crée pas de sprint, ne modifie
pas un participant et ne supprime rien, alors que l'API le permettrait.
C'est un choix : ces écrans n'ont pas été demandés.

## Comment ça a été vérifié

Faux back rejouant le contrat de `docs/api/` sur le port 8099 : cinq
participants dont un nom à rallonge et un sans nom de famille, cinq
inscriptions couvrant les quatre statuts, six paiements couvrant les quatre
leurs.

Testé le 2026-11-02 en rejouant les formulaires **comme un navigateur sans
JavaScript** — ce qui vérifie du même coup que le panneau fonctionne avant
l'hydratation :

- connexion : mauvais mot de passe, compte sans le rôle `ADMIN`, bons
  identifiants (cookie `HttpOnly` posé, `303` vers `/admin`)
- garde : sans cookie → `307` vers la connexion ; déjà connecté sur la
  page de connexion → `307` vers le panneau ; cookie bricolé → l'API
  refuse, retour à la connexion
- les six tuiles du tableau de bord, recalculées à la main
- filtres : par statut, par nom, par référence, et une recherche sans
  résultat
- les quatre cas de transition, dont `CONFIRMED` non soldée qui masque
  « Terminée », et un `COMPLETED` forcé qui se fait refuser avec le bon
  message
- `recheck` sur un `PENDING` : passe à `SUCCESS` avec sa date
- API éteinte : message honnête, pas d'écran blanc
- identifiant inexistant et identifiant non numérique : bloc
  « introuvable », aucune donnée dans la page
- le site public reste intact, et ne traverse pas le proxy

## Ce qui manque

- [ ] **Les identifiants.** Il faut un compte `ADMIN` chez Youssouf. Le
      panneau n'a jamais été essayé contre la vraie API, seulement contre
      le faux back — faute de compte, pas faute de temps.
- [ ] Pas d'écran de gestion des **sessions** (`sprints`), alors que
      l'API sait les créer et les activer. C'est pourtant ce qui
      débloquerait le site public aujourd'hui : voir
      [stack.md](./stack.md).
- [ ] Pas d'écran **participants**, ni de gestion des **administrateurs**.
- [ ] Pas d'export. L'API n'en propose pas non plus.
- [ ] Le défilement fluide (Lenis) du site public s'applique aussi ici,
      puisqu'il est monté dans la coquille racine. Dans un tableau, c'est
      plus gênant qu'agréable — à trancher avec Malik avant d'y toucher,
      parce que l'en retirer veut dire modifier la coquille du site
      public.

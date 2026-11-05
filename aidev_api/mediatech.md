# CAHIER DES CHARGES
## Système de gestion et de digitalisation d'une médiathèque pour les jeunes

**Version :** 1.0  
**Nature du projet :** Application de gestion, de suivi des adhérents, des abonnements et de contrôle d'accès aux postes informatiques.  
**Public cible :** Jeunes adhérents, agents d'accueil, responsables de la médiathèque et administrateurs.

---

# 1. Présentation générale du projet

## 1.1. Contexte

La médiathèque met à la disposition des jeunes un espace de travail équipé d'ordinateurs. L'accès à cet espace est conditionné par une adhésion et le paiement d'un abonnement périodique, notamment mensuel.

La gestion des adhérents, des paiements, des abonnements et des passages nécessite un système centralisé permettant de simplifier le travail du personnel et d'améliorer le suivi de l'activité.

Le projet consiste à mettre en place une solution numérique permettant de gérer l'ensemble du cycle de vie d'un adhérent, depuis son inscription jusqu'à l'utilisation des équipements de la médiathèque.

La solution devra également automatiser le contrôle d'accès aux ordinateurs afin de limiter leur utilisation aux adhérents autorisés.

## 1.2. Objectif général

Mettre en place une plateforme numérique centralisée permettant de digitaliser la gestion administrative et opérationnelle de la salle informatique de la médiathèque.

## 1.3. Objectifs spécifiques

Le système devra permettre de :

- Numériser les inscriptions et les dossiers des adhérents.
- Gérer les abonnements et leurs dates de validité.
- Enregistrer les paiements et les renouvellements.
- Faciliter le paiement des abonnements par Mobile Money.
- Contrôler automatiquement l'accès aux ordinateurs.
- Enregistrer les passages et les durées d'utilisation.
- Suivre la fréquentation de la salle.
- Connaître l'état et la disponibilité des ordinateurs.
- Faciliter le travail des agents d'accueil.
- Produire des rapports statistiques pour les responsables.
- Conserver un historique des opérations importantes.
- Réduire les erreurs de gestion manuelle et les risques d'utilisation non autorisée des postes.

---

# 2. Périmètre fonctionnel du projet

La solution sera organisée autour de cinq composantes principales.

### 2.1. Portail des adhérents

Interface web accessible depuis un téléphone ou un ordinateur, permettant aux jeunes de s'inscrire, de consulter leur abonnement et d'effectuer leurs paiements.

### 2.2. Application d'administration

Interface web réservée au personnel habilité, permettant de gérer les adhérents, les abonnements, les paiements, les ordinateurs et les statistiques.

### 2.3. Application de contrôle d'accès Windows

Application installée sur chaque ordinateur de la médiathèque. Elle contrôle l'accès au poste en fonction des autorisations enregistrées et applique les règles de verrouillage et de fin de session.

### 2.4. Serveur applicatif

Service central chargé de gérer les données, les abonnements, les paiements, les autorisations, les événements et la communication avec les ordinateurs.

### 2.5. Service de paiement

Composant chargé d'intégrer les moyens de paiement retenus et de confirmer les transactions avant d'activer ou de prolonger un abonnement.

---

# 3. Acteurs et rôles

## 3.1. Visiteur

Le visiteur est une personne qui souhaite accéder aux services de la médiathèque sans être encore inscrite.

Il peut :
- Consulter les informations relatives à la médiathèque.
- Découvrir les conditions d'adhésion.
- Consulter les tarifs et les formules d'abonnement.
- Accéder au formulaire d'inscription.

## 3.2. Adhérent

L'adhérent est un jeune dont le dossier a été enregistré dans le système.

Il peut :
- Consulter son profil et son identifiant d'adhérent.
- Consulter l'état de son abonnement.
- Consulter sa date d'expiration.
- Consulter son historique de paiements.
- Renouveler son abonnement.
- Effectuer un paiement en ligne si ce service est disponible.
- Consulter les informations relatives à ses passages, selon les règles retenues par la médiathèque.

L'adhérent ne peut utiliser les ordinateurs que si les conditions d'accès définies par la médiathèque sont satisfaites.

## 3.3. Agent d'accueil

L'agent d'accueil assure la gestion quotidienne des adhérents.

Il peut :
- Enregistrer un nouvel adhérent.
- Compléter ou corriger un dossier.
- Rechercher un adhérent.
- Consulter son statut et la validité de son abonnement.
- Enregistrer un paiement effectué à l'accueil.
- Effectuer un renouvellement manuel autorisé.
- Vérifier un reçu ou une transaction.
- Consulter les passages.
- Aider un adhérent à résoudre un problème d'accès.

Les opérations financières et administratives effectuées par l'agent doivent être enregistrées dans le journal d'audit.

## 3.4. Administrateur

L'administrateur gère la configuration générale du système.

Il peut :
- Créer et gérer les comptes du personnel.
- Attribuer les rôles et les permissions.
- Gérer les tarifs et les formules d'abonnement.
- Configurer les règles de renouvellement.
- Gérer les ordinateurs et leur enrôlement.
- Consulter les paiements et les opérations de renouvellement.
- Consulter les statistiques.
- Consulter les journaux d'audit.
- Suspendre un compte en cas de nécessité, conformément aux règles définies.

Les actions sensibles doivent être protégées par des permissions spécifiques.

---

# 4. Module 1 — Gestion des adhérents

## 4.1. Inscription

Le système doit proposer un formulaire permettant de créer un dossier d'adhérent.

Les informations à recueillir seront déterminées avec la médiathèque. Le formulaire pourra notamment comporter :

- Nom et prénom.
- Date de naissance, si nécessaire.
- Numéro de téléphone.
- Adresse électronique, si disponible.
- Établissement scolaire ou niveau d'études, si pertinent.
- Date d'inscription.
- Identifiant unique d'adhérent.
- Statut du dossier.

Le système doit empêcher la création involontaire de plusieurs dossiers pour une même personne, notamment en détectant les numéros de téléphone ou les identifiants déjà utilisés.

Les règles de détection des doublons devront tenir compte des situations légitimes dans lesquelles plusieurs personnes peuvent partager certaines coordonnées.

## 4.2. Validation de l'inscription

La médiathèque devra choisir entre deux modes :

**Mode A : inscription autonome**

Le jeune remplit son formulaire en ligne. Son dossier est créé, puis il peut être soumis à validation par le personnel.

**Mode B : inscription assistée**

Le jeune fournit ses informations à l'accueil et l'agent crée son dossier dans le système.

Le système devra permettre, si nécessaire, de combiner les deux modes.

## 4.3. Identifiant d'adhérent

Chaque adhérent reçoit un identifiant unique permettant de retrouver son dossier.

Cet identifiant pourra être utilisé pour :
- Se connecter au poste informatique.
- Consulter son abonnement.
- Effectuer un paiement.
- Retrouver son historique.
- Être identifié par l'agent d'accueil.

Le système pourra générer un QR code personnel pour faciliter certaines opérations, sans en faire l'unique moyen d'identification.

## 4.4. Gestion du dossier

Le personnel autorisé pourra consulter et modifier les informations d'un adhérent.

Le système devra distinguer :
- Un dossier en attente de validation.
- Un dossier actif.
- Un dossier suspendu.
- Un dossier archivé.

La suspension d'un dossier devra empêcher tout nouvel accès lorsque la règle de sécurité l'exige, sans supprimer l'historique des opérations.

L'archivage ne devra pas entraîner la suppression des données qui doivent être conservées pour des raisons administratives ou légales.

---

# 5. Module 2 — Gestion des abonnements

## 5.1. Création des formules

L'administrateur pourra définir les formules proposées par la médiathèque.

Chaque formule comportera :
- Un nom.
- Une description.
- Un tarif.
- Une durée de validité.
- Une date d'entrée en vigueur.
- Un statut actif ou inactif.

La formule mensuelle sera la formule principale prévue pour le lancement.

D'autres formules pourront être ajoutées ultérieurement si la médiathèque souhaite proposer des abonnements trimestriels ou annuels.

## 5.2. Attribution d'un abonnement

Un abonnement sera associé à un adhérent.

Il comportera :
- L'adhérent concerné.
- La formule choisie.
- La date de début.
- La date de fin.
- Le montant dû.
- Le montant réglé.
- Le statut de paiement.
- Le statut de l'abonnement.

Le système devra distinguer le statut financier du statut de validité de l'abonnement.

Par exemple, un abonnement peut être expiré alors que son paiement historique est bien enregistré comme payé.

## 5.3. Renouvellement

Le renouvellement pourra être effectué :
- Automatiquement après confirmation d'un paiement en ligne.
- Manuellement par un agent autorisé après vérification du paiement.

Le renouvellement devra respecter les règles de calcul des dates définies par la médiathèque.

À titre de règle proposée :
- Si l'abonnement est encore valide, le renouvellement prolonge sa date de fin.
- Si l'abonnement est expiré, le nouvel abonnement commence à la date définie par la politique de renouvellement.
- Un même paiement ne peut pas déclencher plusieurs renouvellements.

Les règles exactes devront être validées avant le développement.

## 5.4. Expiration et suspension

Le système devra détecter les abonnements arrivant à expiration ou déjà expirés.

Il devra permettre :
- D'afficher les adhérents dont l'abonnement arrive bientôt à échéance.
- De signaler les abonnements expirés.
- De bloquer l'accès aux postes lorsque l'abonnement n'est plus valide.
- D'informer l'adhérent des démarches à effectuer.

La durée de préavis et les éventuelles périodes de grâce devront être configurables.

## 5.5. Historique

Chaque adhérent devra disposer d'un historique des abonnements comprenant :
- Les formules souscrites.
- Les dates de début et de fin.
- Les renouvellements.
- Les montants associés.
- Les paiements correspondants.
- Les éventuelles annulations ou corrections administratives.

L'historique ne devra pas être effacé lors d'un renouvellement.

---

# 6. Module 3 — Gestion des paiements

## 6.1. Moyens de paiement

Le système devra prendre en charge les paiements autorisés par la médiathèque.

Les moyens envisagés sont :
- Mobile Money.
- Paiement enregistré à l'accueil.
- Autres moyens éventuellement retenus par la direction.

Les opérateurs Mobile Money et le prestataire de paiement seront choisis après vérification de leur disponibilité en Côte d'Ivoire, de leurs frais, de leurs conditions contractuelles et de leurs capacités techniques.

## 6.2. Parcours de paiement en ligne

Le parcours sera le suivant :

1. L'adhérent ouvre son espace personnel.
2. Il consulte le tarif et choisit son abonnement.
3. Le système crée une demande de paiement.
4. L'adhérent effectue le paiement auprès du prestataire.
5. Le prestataire transmet le résultat de la transaction au serveur.
6. Le serveur vérifie l'authenticité et la cohérence de la confirmation.
7. Si le paiement est confirmé, l'abonnement est activé ou renouvelé.
8. Un reçu est généré.
9. Les interfaces concernées sont actualisées.

Un simple retour du navigateur vers une page de succès ne devra jamais suffire à confirmer un paiement.

## 6.3. Statuts des transactions

Une transaction pourra présenter les statuts suivants :
- En attente.
- Payée.
- Échouée.
- Annulée.
- En cours de vérification.
- Remboursée, si les remboursements sont pris en charge.

Les statuts devront être gérés de manière cohérente avec les informations du prestataire.

## 6.4. Vérification et rapprochement

Le personnel habilité devra pouvoir consulter :
- La référence de transaction.
- L'adhérent concerné.
- Le montant attendu.
- Le montant reçu.
- La date de la demande.
- La date de confirmation.
- Le statut actuel.

Le système devra permettre une vérification complémentaire auprès du prestataire en cas de doute.

Il devra empêcher :
- L'activation d'un abonnement sur la base d'un paiement non confirmé.
- Le double traitement d'une même confirmation.
- L'affectation d'un paiement au mauvais adhérent.
- La modification silencieuse de l'historique financier.

Les corrections manuelles devront être justifiées et auditées.

## 6.5. Paiement à l'accueil

Lorsqu'un adhérent paie directement auprès du personnel, l'agent devra pouvoir enregistrer le règlement.

Le système devra conserver le mode de paiement, le montant, la date, la référence éventuelle et l'identité de l'agent ayant enregistré l'opération.

Un reçu pourra être généré.

---

# 7. Module 4 — Contrôle d'accès aux ordinateurs

## 7.1. Objectif

Chaque ordinateur de la médiathèque devra disposer d'une application chargée de contrôler l'accès à la session de travail.

L'accès ne devra être accordé qu'aux adhérents autorisés conformément aux règles définies.

## 7.2. Enrôlement des ordinateurs

Chaque poste devra être enregistré dans le système.

Les informations associées pourront comprendre :
- Un identifiant unique du poste.
- Un nom de poste.
- Son emplacement.
- Son état opérationnel.
- Sa dernière date de communication avec le serveur.
- Sa version logicielle.

Chaque poste devra disposer d'une identité technique propre afin d'empêcher un ordinateur non autorisé de se faire passer pour un poste enregistré.

## 7.3. Démarrage du poste

Au démarrage, l'ordinateur ouvre l'environnement Windows prévu pour le kiosque.

L'application de contrôle d'accès s'affiche et empêche l'utilisateur d'accéder directement à l'environnement de travail tant qu'une session autorisée n'a pas été ouverte.

Le dispositif devra être configuré de façon à empêcher le contournement ordinaire de l'écran d'accueil par les utilisateurs.

La mise en place devra tenir compte des mécanismes de sécurité de Windows, des comptes administrateurs et des possibilités de récupération en cas de panne.

## 7.4. Identification sur le poste

Deux méthodes d'identification sont envisagées.

### Méthode A : identifiant et code PIN

L'adhérent saisit :
- Son identifiant.
- Son code PIN.
- Le motif de sa visite.

Le système vérifie localement les informations d'identification, puis détermine si les conditions d'accès sont satisfaites.

### Méthode B : identification par téléphone

L'application affiche un QR code permettant d'ouvrir une page web associée au poste.

L'adhérent saisit sur son téléphone :
- Son identifiant.
- Son code PIN.
- Le code temporaire affiché sur le poste.
- Le motif de sa visite.

Le serveur vérifie les informations et transmet une autorisation au poste.

Le QR code et le code temporaire devront être conçus pour limiter les risques de réutilisation, d'usurpation et de validation d'une session sur le mauvais ordinateur.

## 7.5. Vérification des conditions d'accès

Avant l'ouverture d'une session, le système devra vérifier :
- Que l'adhérent existe.
- Que son dossier est autorisé à accéder au service.
- Que son abonnement est valide selon les règles de la médiathèque.
- Que le poste est autorisé à fonctionner.
- Qu'aucune autre règle de blocage ne s'applique.

Si toutes les conditions sont satisfaites, le poste ouvre l'accès à l'environnement de travail.

Dans le cas contraire, l'application affiche un message explicatif.

## 7.6. Cas d'un abonnement expiré

Si l'abonnement est expiré, l'application devra afficher un message tel que :

« Votre abonnement a expiré. Merci de vous rendre à l'accueil ou de renouveler votre abonnement en ligne. »

Le système pourra proposer un QR code permettant d'ouvrir la page de renouvellement sur le téléphone.

Une fois le paiement confirmé, le poste devra pouvoir recevoir une autorisation de déverrouillage.

## 7.7. Enregistrement des passages

Chaque accès autorisé devra créer un enregistrement comportant notamment :
- L'identifiant de l'adhérent.
- L'identifiant du poste.
- La date et l'heure de début.
- Le motif de la visite.
- La méthode d'identification utilisée.
- La date et l'heure de fin.
- Le statut de la session.

Les événements importants, comme une fermeture forcée ou une perte de communication, devront être consignés.

## 7.8. Fin de session

La session devra pouvoir prendre fin dans les situations suivantes :
- L'adhérent clique sur le bouton « Terminer ».
- La durée maximale autorisée est atteinte.
- Le personnel autorisé intervient.
- Une fermeture de session est nécessaire à la suite d'un incident.

À la fin de la session, le système devra :
1. Enregistrer la date et l'heure de fin.
2. Clore le passage.
3. Fermer la session Windows de l'utilisateur.
4. Revenir à l'écran d'accueil du kiosque.

La fermeture devra être réalisée de manière à empêcher le prochain utilisateur d'accéder aux données de la session précédente.

## 7.9. Fonctionnement sans Internet

Le système devra continuer à fonctionner en cas d'interruption temporaire de la connexion Internet, dans les limites des autorisations locales disponibles.

Le poste conservera les informations nécessaires à l'authentification locale et mettra les événements en attente de synchronisation.

Les règles suivantes devront être appliquées :

- Les informations d'identification seront conservées sous une forme sécurisée.
- Les événements seront enregistrés localement avant leur synchronisation.
- Les événements déjà transmis ne devront pas être enregistrés une seconde fois.
- Les identifiants d'événements devront permettre de gérer les doublons.
- La synchronisation devra reprendre automatiquement lorsque la connexion sera rétablie.

**Limite importante :** une validation locale ne peut pas garantir à elle seule qu'un abonnement est toujours valide si celui-ci a été suspendu ou expiré après la dernière synchronisation. Le système devra donc utiliser une politique de cache définie : durée de validité des autorisations locales, délai maximal hors ligne et règles de révocation.

Cette politique devra trouver un équilibre entre continuité du service et contrôle des accès.

---

# 8. Module 5 — Gestion des motifs de visite

La médiathèque devra pouvoir définir les motifs proposés aux adhérents.

À titre d'exemple :
- Recherche documentaire.
- Formation ou apprentissage.
- Travaux scolaires.
- Recherche d'emploi.
- Programmation et développement.
- Consultation de ressources numériques.
- Autre.

La liste définitive sera validée par la direction.

Le motif sera sélectionné avant l'ouverture de la session et associé au passage correspondant.

L'administration pourra consulter les statistiques de fréquentation par motif.

Les motifs devront être configurables sans modification du code de l'application.

---

# 9. Module 6 — Gestion du parc informatique

Le système devra permettre de suivre l'état des ordinateurs de la salle.

Chaque poste pourra présenter un état parmi les suivants :
- En ligne et disponible.
- En cours d'utilisation.
- Hors ligne.
- En maintenance.
- Désactivé administrativement.

L'interface d'administration affichera :
- Le nom du poste.
- Son emplacement.
- Son état actuel.
- L'adhérent utilisant le poste, lorsque cela est nécessaire et autorisé.
- L'heure de début de la session.
- La dernière communication avec le serveur.
- La version de l'application installée.

L'administrateur pourra :
- Enregistrer un nouveau poste.
- Modifier ses informations.
- Désactiver un poste.
- Consulter son historique.
- Identifier les postes qui ne communiquent plus.
- Consulter les erreurs signalées par l'application.

Un poste en maintenance ne devra pas accepter de nouvelle session.

---

# 10. Module 7 — Tableau de bord administratif

Le tableau de bord devra présenter une vue synthétique de l'activité de la médiathèque.

## 10.1. Indicateurs de gestion

Les indicateurs envisagés sont :
- Nombre total d'adhérents.
- Nombre d'adhérents actifs.
- Nombre d'abonnements valides.
- Nombre d'abonnements expirés.
- Nombre d'abonnements arrivant bientôt à échéance.
- Nombre de passages du jour.
- Nombre de sessions en cours.
- Nombre de postes disponibles.
- Nombre de postes occupés.
- Nombre de postes hors ligne.
- Montant des paiements confirmés sur la période.

Les chiffres financiers devront être calculés à partir des transactions confirmées, et non des simples demandes de paiement.

## 10.2. État des ordinateurs en direct

Le tableau de bord présentera l'état des postes.

Les changements d'état devront être transmis automatiquement lorsque cela est possible.

L'interface devra distinguer un poste réellement disponible d'un poste dont l'état est inconnu à cause d'une perte de communication.

## 10.3. Filtres

Les indicateurs devront pouvoir être filtrés par période lorsque cela est pertinent.

Les périodes proposées pourront inclure :
- Aujourd'hui.
- Cette semaine.
- Ce mois-ci.
- Une période personnalisée.

---

# 11. Module 8 — Rapports et statistiques

## 11.1. Rapport de fréquentation

Le système devra permettre de consulter les passages :
- Par jour.
- Par période.
- Par heure.
- Par motif.
- Par ordinateur.
- Par adhérent, selon les permissions.

Un passage correspondra à une session enregistrée, et non nécessairement à une personne unique.

Les rapports devront distinguer le nombre de passages du nombre d'adhérents différents.

## 11.2. Rapport sur les adhérents

L'administration pourra consulter :
- Le nombre de nouveaux adhérents.
- Le nombre d'adhérents actifs.
- Le nombre d'adhérents suspendus.
- Le classement des adhérents les plus assidus.
- L'évolution du nombre d'adhérents sur une période.

## 11.3. Rapport sur les abonnements

Le système devra afficher :
- Les abonnements actifs.
- Les abonnements expirés.
- Les abonnements arrivant à échéance.
- Les renouvellements réalisés.
- L'historique des abonnements par adhérent.

## 11.4. Rapport financier

Le système devra permettre de consulter :
- Le montant des paiements confirmés.
- Le nombre de transactions payées.
- Les transactions en attente.
- Les transactions échouées.
- Les renouvellements enregistrés.
- Les recettes par période.
- Les recettes par moyen de paiement.

Les recettes devront être distinguées des montants simplement attendus ou des paiements en cours de vérification.

## 11.5. Exportation

Les rapports autorisés pourront être exportés au format CSV.

Les exports devront respecter les permissions de l'utilisateur et ne contenir que les données nécessaires à l'usage prévu.

---

# 12. Module 9 — Journal d'audit

Le système devra conserver une trace des opérations sensibles.

Les événements à enregistrer comprendront notamment :
- La création et la modification d'un adhérent.
- La suspension ou la réactivation d'un dossier.
- La création et la modification d'une formule tarifaire.
- Les renouvellements manuels.
- Les corrections de paiement.
- Les opérations de remboursement, si elles existent.
- La création et la modification des comptes du personnel.
- Les changements de permissions.
- L'enrôlement ou la désactivation d'un ordinateur.
- Les interventions administratives sur les sessions.

Chaque entrée devra comporter, lorsque cela est pertinent :
- L'identité de l'acteur.
- Le type d'action.
- La date et l'heure.
- L'objet concerné.
- Le résultat de l'opération.
- Une référence permettant de retrouver l'opération.
- Un motif justificatif pour certaines actions sensibles.

Les utilisateurs ordinaires ne devront pas pouvoir modifier ou supprimer les journaux d'audit.

---

# 13. Interfaces attendues

## 13.1. Portail public et espace adhérent

Les pages à concevoir sont :

1. Page d'accueil et présentation de la médiathèque.
2. Présentation des conditions d'adhésion.
3. Présentation des formules et des tarifs.
4. Formulaire d'inscription.
5. Page de confirmation de création du dossier.
6. Page de connexion.
7. Espace personnel de l'adhérent.
8. Consultation du statut de l'abonnement.
9. Historique des paiements.
10. Page de renouvellement.
11. Page de paiement.
12. Page de résultat du paiement.
13. Consultation du reçu, si cette fonctionnalité est retenue.
14. Page d'aide et d'assistance.

Les interfaces devront être adaptées aux téléphones mobiles, qui constituent un moyen important d'accès au service.

## 13.2. Interface d'administration

Les sections suivantes devront être prévues :

- Tableau de bord.
- Adhérents.
- Dossiers en attente de validation.
- Abonnements.
- Formules et tarifs.
- Paiements.
- Passages et fréquentation.
- Ordinateurs.
- Sessions en cours.
- Rapports et statistiques.
- Journal d'audit.
- Comptes du personnel.
- Rôles et permissions.
- Paramètres généraux.

Chaque section devra disposer des fonctions nécessaires de recherche, de filtrage, de consultation et, lorsque cela est autorisé, de création ou de modification.

## 13.3. Interface Windows

L'application Windows devra comprendre :
- Un écran d'accueil plein écran.
- Un formulaire d'identification.
- Un champ de saisie du code PIN.
- Un choix du motif de visite.
- Un QR code pour l'identification par téléphone.
- Un affichage du statut de l'abonnement.
- Des messages d'erreur explicites.
- Un accès au renouvellement en cas d'expiration.
- Un écran de session en cours, si nécessaire.
- Un bouton « Terminer ».
- Un mécanisme de retour à l'écran d'accueil.

L'application devra être conçue pour fonctionner de manière fiable et empêcher les contournements ordinaires de l'écran de contrôle.

---

# 14. Architecture technique proposée

L'architecture initialement envisagée repose sur les technologies suivantes.

## 14.1. Application Windows

**Technologie : Rust**

L'application sera divisée en deux composants :

- Un service Windows chargé des opérations système, de la gestion sécurisée du cache, de la synchronisation et de la communication avec le serveur.
- Une interface plein écran chargée de l'identification et de l'expérience utilisateur.

Cette séparation vise à limiter l'exposition des secrets et à améliorer la fiabilité du contrôle d'accès.

Le service devra appliquer des permissions strictes aux fichiers locaux et aux données sensibles.

## 14.2. Backend

**Technologies : Cloudflare Workers et Hono**

Le backend assurera :
- La gestion des adhérents.
- La gestion des abonnements.
- Le traitement des paiements.
- Le contrôle des autorisations.
- La gestion des postes.
- L'enregistrement des passages.
- La génération des rapports.
- La communication avec les applications Windows.
- La gestion des comptes et permissions.

Les opérations sensibles devront être réalisées côté serveur.

## 14.3. Base de données

**Technologie : Cloudflare D1**

La base de données centralisera les informations relatives :
- Aux adhérents.
- Aux utilisateurs administratifs.
- Aux rôles et permissions.
- Aux formules d'abonnement.
- Aux abonnements.
- Aux paiements.
- Aux ordinateurs.
- Aux sessions.
- Aux passages.
- Aux journaux d'audit.

Le schéma devra garantir l'intégrité des données, notamment les relations entre les adhérents, les abonnements, les paiements et les passages.

## 14.4. Communication en temps réel

**Technologie envisagée : Cloudflare Durable Objects**

Un objet pourra être associé à chaque poste pour gérer son état et les événements qui lui sont destinés.

Cette architecture permettra notamment de :
- Suivre la connexion des postes.
- Transmettre les autorisations de déverrouillage.
- Informer un poste de la confirmation d'un paiement.
- Signaler les changements d'état.
- Gérer les événements en temps réel.

Le système devra toutefois prévoir les reconnexions, les messages dupliqués et les interruptions réseau.

## 14.5. Frontend web

**Technologie : Vue 3**

Vue 3 sera utilisé pour construire :
- Le portail public.
- L'espace adhérent.
- Le panneau d'administration.

Les composants devront être organisés par modules fonctionnels afin de faciliter les évolutions.

## 14.6. Hébergement

L'hébergement sur Cloudflare est envisagé afin de limiter les coûts d'infrastructure et de réduire les besoins de maintenance.

Cependant, le coût réel dépendra des limites des offres retenues, du volume de données, des requêtes, des communications en temps réel, du domaine et des prestataires de paiement.

L'objectif sera de maintenir les dépenses aussi faibles que possible, sans faire de la gratuité une exigence susceptible de compromettre la fiabilité du service.

---

# 15. Sécurité et protection des données

La solution devra intégrer la sécurité dès sa conception.

## 15.1. Authentification

Les comptes administratifs devront utiliser une authentification sécurisée.

Les codes PIN des adhérents ne devront jamais être conservés en clair dans la base de données.

Le système devra appliquer une méthode adaptée de dérivation et de vérification des PIN, avec une protection contre les tentatives répétées.

## 15.2. Sécurisation des communications

Les échanges entre le navigateur, le serveur et les ordinateurs devront être protégés par des mécanismes de communication sécurisés.

Les identifiants techniques des postes devront être protégés et ne pas être partagés entre tous les ordinateurs.

## 15.3. Gestion des permissions

Les autorisations devront être vérifiées côté serveur.

Le fait de masquer un bouton dans une interface ne devra pas suffire à empêcher un utilisateur non autorisé d'effectuer une opération.

## 15.4. Sécurité des paiements

Les confirmations de paiement devront être authentifiées et vérifiées.

Les clés secrètes des prestataires ne devront pas être exposées dans le frontend ni dans l'application Windows.

## 15.5. Protection des données personnelles

Le système devra limiter la collecte aux informations nécessaires au fonctionnement de la médiathèque.

Il faudra définir :
- Les données réellement nécessaires à l'inscription.
- Les personnes autorisées à consulter chaque catégorie de données.
- Les durées de conservation.
- Les règles d'archivage.
- Les conditions de suppression ou d'anonymisation.
- Les mesures de sauvegarde.
- Les procédures de gestion des incidents.

Les obligations applicables en Côte d'Ivoire, notamment celles relatives à la protection des données personnelles, devront être vérifiées avant la mise en production.

## 15.6. Sécurité physique et système des postes

Le contrôle d'accès ne devra pas reposer uniquement sur une interface plein écran.

Le déploiement devra prévoir :
- Un compte Windows dédié au kiosque.
- Des droits limités pour les utilisateurs.
- Une séparation avec les comptes administrateurs.
- Une configuration contrôlée de la session Windows.
- Des mécanismes de récupération réservés au personnel autorisé.
- Une protection contre les sorties ordinaires du kiosque.
- Une procédure de maintenance et de restauration.

Aucun système de verrouillage logiciel ne peut garantir à lui seul une protection absolue contre une personne disposant d'un accès physique et de privilèges administratifs sur le poste.

---

# 16. Exigences de fonctionnement

## 16.1. Disponibilité

Le service devra être conçu pour rester utilisable malgré les interruptions temporaires du réseau.

Les limites du fonctionnement hors ligne devront être clairement définies.

## 16.2. Fiabilité des données

Le système devra garantir que :
- Chaque paiement possède une référence identifiable.
- Chaque passage possède un identifiant unique.
- Les synchronisations répétées ne créent pas de doublons.
- Un renouvellement ne peut pas être appliqué plusieurs fois à la suite d'un même événement.
- Les historiques ne disparaissent pas lors des modifications d'un dossier.

## 16.3. Ergonomie

Les interfaces devront être simples à utiliser par des jeunes et par du personnel ne disposant pas nécessairement de compétences informatiques avancées.

Les messages d'erreur devront expliquer le problème et, si possible, indiquer la démarche à suivre.

## 16.4. Maintenance

Le système devra permettre :
- La mise à jour contrôlée des applications.
- Le suivi des erreurs.
- La consultation de l'état des postes.
- La sauvegarde et la restauration des données.
- La documentation des opérations de maintenance.

## 16.5. Compatibilité

L'application de contrôle d'accès devra être compatible avec les versions de Windows retenues par la médiathèque.

Les versions exactes de Windows, les caractéristiques des ordinateurs et les contraintes matérielles devront être relevées avant le développement.

---

# 17. Scénarios fonctionnels de référence

## Scénario 1 : nouvel adhérent

1. Un jeune remplit le formulaire d'inscription ou se présente à l'accueil.
2. Son dossier est créé.
3. Le personnel vérifie les informations si nécessaire.
4. L'adhérent choisit une formule d'abonnement.
5. Il effectue le paiement.
6. Le paiement est confirmé.
7. L'abonnement est activé.
8. L'adhérent peut utiliser les ordinateurs conformément aux règles d'accès.

## Scénario 2 : adhérent à jour

1. L'adhérent se présente devant un ordinateur.
2. Il saisit son identifiant et son PIN.
3. Il choisit son motif de visite.
4. Le système vérifie son identité et son autorisation locale.
5. L'accès au poste est accordé.
6. Le passage est enregistré.
7. À la fin de l'utilisation, la session est clôturée.

## Scénario 3 : abonnement expiré

1. L'adhérent tente de se connecter.
2. Le système constate que son abonnement n'est plus valide.
3. L'accès est refusé.
4. L'écran lui indique de se rendre à l'accueil ou de renouveler son abonnement.
5. Il effectue le renouvellement.
6. Le paiement est confirmé.
7. Le système accorde l'accès conformément à la politique de synchronisation et d'autorisation.

## Scénario 4 : paiement depuis un téléphone

1. L'adhérent scanne le QR code affiché sur le poste.
2. Il ouvre la page sécurisée associée à ce poste.
3. Il s'identifie et confirme son intention de renouveler.
4. Il effectue le paiement.
5. Le serveur reçoit et vérifie la confirmation du prestataire.
6. L'abonnement est activé ou renouvelé.
7. Une autorisation est transmise au poste.
8. Le poste ouvre la session si les autres conditions d'accès sont satisfaites.

## Scénario 5 : perte d'Internet

1. Le poste perd la connexion au serveur.
2. L'application détecte la perte de communication.
3. L'adhérent tente de s'identifier.
4. Le système applique la politique d'authentification locale et vérifie la validité des autorisations mises en cache.
5. Si les conditions hors ligne sont satisfaites, l'accès est accordé.
6. Le passage est enregistré localement.
7. À la reprise de la connexion, les événements sont synchronisés.
8. Le serveur traite les événements sans créer de doublons.

## Scénario 6 : ordinateur indisponible

1. Un ordinateur est déclaré en maintenance ou cesse de communiquer.
2. Le tableau de bord signale son indisponibilité ou l'incertitude sur son état.
3. Le personnel peut intervenir.
4. Le poste ne doit pas accepter de nouvelle session lorsqu'il est désactivé administrativement.

---

# 18. Critères de validation et de recette

Le projet sera considéré comme fonctionnel lorsque les principaux scénarios auront été testés et validés.

Les tests devront notamment vérifier que :

1. Un nouvel adhérent peut être enregistré.
2. Un identifiant unique est attribué à chaque adhérent.
3. Un abonnement peut être créé et renouvelé.
4. Un paiement confirmé active le service prévu.
5. Un paiement non confirmé ne donne pas accès au service sur la seule base d'une page de succès.
6. Un abonnement expiré entraîne le refus d'accès.
7. Un adhérent autorisé peut ouvrir une session.
8. Le passage est enregistré avec les bonnes informations.
9. La fin de session ramène le poste à l'écran d'accueil.
10. Un renouvellement confirmé peut débloquer le poste concerné.
11. Une perte d'Internet déclenche le fonctionnement hors ligne prévu.
12. Les événements hors ligne sont synchronisés sans doublons.
13. Les statistiques correspondent aux données enregistrées.
14. Les permissions empêchent les opérations non autorisées.
15. Les opérations sensibles apparaissent dans le journal d'audit.
16. Les données peuvent être sauvegardées et restaurées.
17. Les procédures de récupération d'un poste en panne ont été testées.

La recette devra être effectuée sur les ordinateurs réellement utilisés par la médiathèque, avec des tests d'accès, de déconnexion, de perte de réseau et de reprise après incident.

---

# 19. Déploiement et accompagnement

Le déploiement devra être réalisé progressivement.

### Phase 1 : préparation

- Recueillir les besoins définitifs de la médiathèque.
- Définir les tarifs et les règles d'adhésion.
- Inventorier les ordinateurs.
- Choisir les moyens de paiement.
- Valider l'architecture technique.

### Phase 2 : développement du socle administratif

- Mettre en place la base de données.
- Développer le backend.
- Développer la gestion des adhérents.
- Développer les abonnements.
- Développer l'administration.

### Phase 3 : paiement et portail adhérent

- Développer l'inscription en ligne.
- Développer l'espace adhérent.
- Intégrer les paiements.
- Mettre en place la confirmation et la vérification des transactions.

### Phase 4 : application Windows

- Développer le kiosque.
- Mettre en place l'authentification.
- Développer le contrôle d'accès.
- Implémenter la gestion hors ligne.
- Mettre en place la synchronisation.

### Phase 5 : tests et pilote

- Installer le système sur un nombre limité d'ordinateurs.
- Tester les scénarios fonctionnels.
- Corriger les anomalies.
- Valider le fonctionnement avec les responsables.

### Phase 6 : mise en production

- Déployer sur les postes restants.
- Former les agents.
- Remettre la documentation.
- Organiser le suivi des incidents et des mises à jour.

---

# 20. Livrables attendus

Le projet devra produire les éléments suivants :

1. Cahier des charges fonctionnel et technique validé.
2. Maquettes des interfaces.
3. Modèle de données et schéma de base de données.
4. Documentation de l'API.
5. Code source du backend.
6. Code source du frontend web.
7. Code source de l'application Windows.
8. Documentation d'installation.
9. Documentation d'administration.
10. Documentation de maintenance.
11. Procédure de sauvegarde et de restauration.
12. Plan de tests et résultats de recette.
13. Guide d'utilisation destiné au personnel.
14. Procédure de déploiement sur les ordinateurs.
15. Documentation relative à la configuration des paiements.

---

# 21. Éléments à préciser avant le développement

Certains choix dépendent du fonctionnement réel de la médiathèque. Ils devront être confirmés par ses responsables.

### Organisation et adhésion

- Quel est le tarif mensuel ?
- L'inscription est-elle gratuite ou payante ?
- Quels documents ou justificatifs sont nécessaires ?
- Les inscriptions doivent-elles être validées par un agent ?
- Les mineurs peuvent-ils s'inscrire et, si oui, quelles règles particulières s'appliquent ?

### Fonctionnement de la salle

- Combien d'ordinateurs sont disponibles ?
- Combien de temps un adhérent peut-il utiliser un poste ?
- Peut-il utiliser plusieurs postes au cours d'une même journée ?
- Existe-t-il des horaires d'ouverture ?
- Le personnel doit-il pouvoir prolonger ou interrompre une session ?
- Les postes doivent-ils rester utilisables pendant une panne prolongée d'Internet ?

### Abonnements

- L'abonnement est-il valable pendant un mois calendaire ou pendant une durée calculée à partir de la date d'activation ?
- Existe-t-il une période de grâce ?
- Un adhérent peut-il suspendre son abonnement ?
- Que se passe-t-il si un paiement échoue après une tentative de renouvellement ?

### Paiements

- Quels opérateurs Mobile Money doivent être acceptés ?
- Le paiement en espèces est-il autorisé ?
- Les paiements partiels sont-ils autorisés ?
- Des reçus doivent-ils être générés automatiquement ?
- Qui est autorisé à effectuer une correction financière ?

### Administration

- Combien de personnes utiliseront le panneau d'administration ?
- Faut-il plusieurs niveaux de permissions ?
- Quels rapports sont réellement nécessaires à la direction ?
- Quelle durée de conservation est prévue pour les données ?

### Technique

- Quelles versions de Windows sont installées ?
- Les ordinateurs sont-ils connectés au même réseau local ?
- Le système doit-il fonctionner intégralement sans Internet pendant plusieurs heures ou plusieurs jours ?
- Existe-t-il déjà un domaine, un hébergement ou une infrastructure informatique ?

---

# 22. Conclusion

Le projet vise à transformer la gestion de la salle informatique en un système numérique structuré, fiable et évolutif.

La solution permettra de centraliser les informations des adhérents, d'automatiser la gestion des abonnements et des paiements, de contrôler l'accès aux ordinateurs et de produire des statistiques utiles à la direction.

Le développement devra privilégier la simplicité d'utilisation, la sécurité des données, la fiabilité des paiements et la continuité du service.

**La priorité sera de construire un système cohérent de gestion de la médiathèque, dans lequel le contrôle d'accès Windows constitue un élément intégré au fonctionnement global, et non une application isolée.**
# Runbook d'Exploitation, Migrations et Rollback — Aidev Classroom

Ce document est le guide de référence pour les équipes d'exploitation SRE et les développeurs gérant la plateforme Aidev Classroom en conditions opérationnelles.

---

## 1. Résumé des Commandes d'Exploitation

Tous les scripts sont situés dans le dossier `scripts/` à la racine du projet et acceptent l'environnement cible en argument (`dev`, `preprod` ou `prod`).

| Action | Commande | Description |
|---|---|---|
| **Déploiement complet** | `./scripts/deploy.sh prod` | Construit les images, démarre la stack et vérifie la santé |
| **Déploiement + Migrations** | `./scripts/deploy.sh prod --with-migrations` | Exécute les migrations Prisma puis déploie l'application |
| **Construction des images** | `./scripts/build.sh prod` | Compile les Dockerfiles multi-stage de production |
| **Démarrage des services** | `./scripts/start.sh prod` | Démarre les conteneurs en tâche de fond (`up -d`) |
| **Arrêt propre** | `./scripts/stop.sh prod` | Arrête les conteneurs sans détruire les volumes ni données |
| **Redémarrage** | `./scripts/restart.sh prod` | Redémarre l'ensemble des conteneurs ou un service ciblé |
| **Consultation des logs** | `./scripts/logs.sh prod -f` | Affiche les logs en continu (`tail -f`) |
| **Logs d'un seul service** | `./scripts/logs.sh prod backend -f` | Affiche les logs du backend uniquement |
| **État & Healthchecks** | `./scripts/status.sh prod` | Inspecte l'état et le résultat des sondes de santé |
| **Migrations Prisma** | `./scripts/migrate.sh prod` | Exécute `npx prisma migrate deploy` dans un conteneur one-shot |
| **Rollback applicatif** | `./scripts/rollback.sh prod <TAG>` | Revient immédiatement à une version précédente taguée |

---

## 2. Procédure Standard de Mise à Jour (Déploiement Continu)

Pour déployer une nouvelle version sur le VPS sans indisponibilité prolongée :

1. Récupérer le code à jour :
   ```bash
   git pull origin main
   ```
2. Sauvegarder la base PostgreSQL externe (indispensable) :
   ```bash
   sudo -u postgres pg_dump -Fc aidev_db > /root/backups/aidev_db-$(date +%F_%H%M%S).dump
   ```
3. Lancer le déploiement :
   ```bash
   ./scripts/deploy.sh prod --with-migrations
   ```
4. Contrôler le succès :
   ```bash
   ./scripts/status.sh prod
   ```

---

## 3. Gestion des Migrations Prisma

### Principes Clés :
- Les migrations ne sont **JAMAIS** déclenchées de façon aveugle ou destructrice lors du simple démarrage d'un conteneur.
- La commande exécutée est `prisma migrate deploy`, qui applique uniquement les migrations validées en attente (`0001_init_pg`, etc.) sans jamais réinitialiser la base (`prisma migrate reset` est proscrit en production).
- L'exécution a lieu dans un conteneur éphémère (`docker compose run --rm backend`) qui se détruit automatiquement dès la fin du processus.

### Commande :
```bash
./scripts/migrate.sh prod
```
Pour charger des données de test ou de configuration initiale (optionnel) :
```bash
./scripts/migrate.sh dev --seed
```

---

## 4. Procédure de Rollback d'Urgence

### Cas A : Régression Applicative (Code Frontend ou Backend défaillant)
Si une nouvelle version applicative présente un bug critique mais que la base de données n'a pas subi de modification incompatible :
1. Identifiez le tag de la version précédente :
   ```bash
   docker images aidev-api --format "{{.Tag}}\t{{.CreatedAt}}"
   ```
2. Exécutez le rollback vers ce tag :
   ```bash
   ./scripts/rollback.sh prod 20261105-180000
   ```
3. Le script redéploie immédiatement les images stables sans recompilation.

### Cas B : Régression de Schéma Base de Données
Prisma ne propose pas de commande « migrate down » automatique.
- Si une migration doit être annulée :
  1. Écrire une migration corrective (qui rétablit les colonnes ou tables) et l'appliquer via `./scripts/migrate.sh prod`.
  2. OU, en cas d'incident majeur sur les données, restaurer la sauvegarde réalisée avant le déploiement :
     ```bash
     sudo -u postgres pg_restore --clean -d aidev_db /root/backups/aidev_db-AVANT_DEPLOY.dump
     ```

---

## 5. Diagnostic et Résolution des Problèmes Fréquents (Troubleshooting)

### Problème 1 : Nginx renvoie `502 Bad Gateway`
- **Cause** : Le conteneur `backend` ou `frontend` est en cours de démarrage, a crashé, ou est déclaré `unhealthy`.
- **Diagnostic** :
  ```bash
  ./scripts/status.sh prod
  ./scripts/logs.sh prod backend --tail=50
  ```
- **Résolution** : Vérifier la connectivité avec PostgreSQL dans les logs du backend (souvent une mauvaise chaîne `DATABASE_URL` ou un mot de passe erroné).

### Problème 2 : « Variable d'environnement manquante : JWT_SECRET »
- **Cause** : NestJS valide strictement les variables au démarrage (`src/config/env.validation.ts`).
- **Résolution** : Vérifier que `.env.prod` est bien présent et que `JWT_SECRET` comporte au moins 32 caractères.

### Problème 3 : Erreurs CORS lors des requêtes Frontend -> API
- **Cause** : La variable `FRONTEND_URL` côté backend ne correspond pas exactement au domaine du frontend.
- **Résolution** : Dans `.env.prod`, s'assurer que `FRONTEND_URL` contient l'URL complète avec le protocole HTTPS exact (ex: `https://classroom.votre-domaine.com`). Si plusieurs origines sont requises, les séparer par une virgule.

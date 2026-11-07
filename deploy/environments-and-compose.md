# Environnements et Fichiers Docker Compose — Aidev Classroom

Ce document détaille l'organisation, le fonctionnement et les spécificités des trois environnements d'Aidev Classroom.

---

## 1. Vue d'Ensemble des Fichiers Compose

| Environnement | Fichier Compose | Fichier d'Environnement | Profil d'Utilisation |
|---|---|---|---|
| **Développement** | `compose.dev.yml` | `.env.dev` | Machine locale du développeur, hot-reload, debugging |
| **Préproduction** | `compose.preprod.yml` | `.env.preprod` | Serveur de staging / recette, validation ISO-prod |
| **Production** | `compose.prod.yml` | `.env.prod` | Serveur VPS de production, Nginx reverse proxy, haute disponibilité |

---

## 2. Environnement de Développement (`compose.dev.yml`)

### Objectifs :
- Démarrage instantané et confort de travail en local.
- Montages de volumes permettant le rechargement à chaud (Hot Module Replacement) :
  - `./aidev_api:/app` (NestJS watch mode)
  - `./aidevsprint:/app` (Next.js Turbopack dev mode)
- Les dossiers `node_modules` et `.next` sont montés en volumes anonymes isolés pour éviter tout écrasement ou conflit binaire entre l'hôte et les conteneurs Alpine Linux.
- Ports accessibles directement sur l'hôte :
  - Frontend : `http://localhost:3000` (paramétrable via `FRONTEND_PORT`)
  - Backend : `http://localhost:3001` (paramétrable via `BACKEND_PORT`)

### Lancement :
```bash
cp .env.dev.example .env.dev
./scripts/start.sh dev
```

---

## 3. Environnement de Préproduction (`compose.preprod.yml`)

### Objectifs :
- Tester les builds immuables (images conteneurisées compilées avec les dépendances de production uniquement).
- Valider le routage via Nginx en conditions réelles sans perturber la production.
- Utiliser un réseau bridge isolé `aidev-preprod-network`.
- Émuler les contraintes de ressources (limite CPU à 1.0, mémoire à 512 Mo).
- Activer la documentation Swagger (`/api/docs`) pour les tests des endpoints par les équipes QA.

### Lancement :
```bash
cp .env.preprod.example .env.preprod
./scripts/deploy.sh preprod --with-migrations
```

---

## 4. Environnement de Production (`compose.prod.yml`)

### Principes Clés d'Ingénierie & SRE :
1. **Zéro exposition directe des conteneurs applicatifs** :
   - Ni le frontend Next.js ni le backend NestJS ne publient de ports sur l'hôte (`ports:` n'est pas utilisé pour eux).
   - Ils utilisent la directive `expose: ["3000"]`, ce qui restreint leur accès exclusivement au réseau interne privé `aidev-prod-network`.
   - Seul Nginx écoute publiquement sur les ports HTTP (`80`) et HTTPS (`443`).

2. **Aucun service PostgreSQL dans la stack** :
   - Conformément aux contraintes impératives du projet, la base de données est gérée de manière externe.
   - La directive `extra_hosts: ["host.docker.internal:host-gateway"]` permet au backend de communiquer avec le PostgreSQL hébergé sur le VPS.

3. **Garantie de non-root** :
   - Le backend s'exécute sous l'utilisateur système `node`.
   - Le frontend s'exécute sous l'utilisateur système `nextjs` (UID 1001).

4. **Réservation et Plafonnement des Ressources** :
   - Frontend & Backend : Limite à 1.5 CPU et 1024 Mo de RAM (avec réservation garantie de 0.5 CPU et 256 Mo).
   - Nginx Proxy : Limite à 0.5 CPU et 256 Mo de RAM.

5. **Rotation des Journaux (Log Rotation)** :
   - Tous les services utilisent le driver Docker `json-file` avec rotation automatique :
     ```yaml
     logging:
       driver: json-file
       options:
         max-size: "10m"
         max-file: "5"
     ```
   - Empêche tout risque de saturation du disque dur du VPS par des logs volumineux.

6. **Healthchecks Automatisés** :
   - Le backend teste sa route native `/api/v1/health` (qui effectue un `SELECT 1` sur PostgreSQL).
   - Le frontend teste sa disponibilité HTTP sur `/`.
   - Le proxy Nginx teste son point d'écoute `/healthz`.
   - La politique `depends_on` avec `condition: service_healthy` garantit que Nginx et le Frontend ne reçoivent du trafic que lorsque le Backend est déclaré sain.

---

## 5. Gestion des Fichiers d'Environnement

Chaque fichier `.env.*` contient les variables nécessaires aux conteneurs :
- L'interpolation Compose utilise la syntaxe `${ENV_FILE:-.env.prod}`, ce qui permet à Docker Compose de trouver directement le bon fichier lorsqu'il est appelé par les scripts ou en ligne de commande.
- Les fichiers réels (`.env.dev`, `.env.preprod`, `.env.prod`) sont strictement ignorés par Git via `.gitignore`.
- Seuls les fichiers modèles `.env.*.example` sont versionnés dans le dépôt.

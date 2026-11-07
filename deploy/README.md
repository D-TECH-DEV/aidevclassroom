# Guide de Déploiement et d'Exploitation — Aidev Classroom

Ce dossier contient l'ensemble de la documentation opérationnelle pour le déploiement, la sécurisation et l'exploitation de la plateforme **Aidev Classroom** sur un VPS Ubuntu utilisant Docker Compose.

---

## 1. Sommaire de la Documentation

1. [Architecture Globale & Rôle des Conteneurs](#2-architecture-globale--rôle-des-conteneurs)
2. [Fonctionnement des Trois Environnements](#3-fonctionnement-des-trois-environnements)
3. [Index des Guides Détaillés](#4-index-des-guides-détaillés)
   - [Guide de Déploiement VPS Ubuntu](vps-setup-guide.md)
   - [Connexion au PostgreSQL Externe](database-setup.md)
   - [Environnements et Fichiers Docker Compose](environments-and-compose.md)
   - [Configuration Nginx et Certificats SSL](nginx-and-ssl.md)
   - [Runbook d'Exploitation, Migrations et Rollback](operations-and-runbook.md)
4. [Rapport Global de Déploiement](../RAPPORT_DEPLOIEMENT.md)

---

## 2. Architecture Globale & Rôle des Conteneurs

L'architecture repose sur une isolation stricte des responsabilités en conteneurs Docker légers, sans jamais héberger la base de données PostgreSQL dans la stack Docker Compose (la base de données est gérée séparément sur le VPS).

```
                             TRAFIC INTERNET (Clients / Navigateurs)
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │   Nginx Reverse Proxy   │ Ports 80 / 443 (HTTP/HTTPS)
                                 │      (aidev-proxy)      │ SSL / Headers / Buffers / Timeouts
                                 └────────────┬────────────┘
                                              │
                                     Réseau Docker Privé
                                     (aidev-prod-network)
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         ┌─────────────────────────┐                     ┌─────────────────────────┐
         │    Frontend Next.js     │                     │     Backend NestJS      │
         │    (aidev-frontend)     │                     │       (aidev-api)       │
         │   Port interne : 3000   │                     │   Port interne : 3000   │
         │ Mode Standalone (Alpine)│                     │ Prisma ORM + Client Pg  │
         │  Utilisateur : nextjs   │                     │   Utilisateur : node    │
         └─────────────────────────┘                     └────────────┬────────────┘
                                                                      │
                                                Réseau Docker Externe / IP Passerelle Hôte
                                                                      ▼
                                                         ┌─────────────────────────┐
                                                         │   PostgreSQL Externe    │
                                                         │  (Existant sur le VPS)  │
                                                         └─────────────────────────┘
```

### Rôle de chaque service :

1. **`proxy` (Nginx 1.27 Alpine)** :
   - Point d'entrée unique de la plateforme en production.
   - Écoute sur les ports publics HTTP (80) et HTTPS (443).
   - Termine le trafic TLS/SSL et gère les certificats Let's Encrypt.
   - Route les requêtes vers le frontend Next.js et l'API NestJS (`/api/`).
   - Masque la topologie interne et applique les en-têtes de sécurité (`X-Forwarded-*`, `Host`).

2. **`frontend` (Next.js 16.4.2 Standalone)** :
   - Interface utilisateur web réactive construite avec React 19 et Tailwind CSS 4.
   - Exécuté en mode `standalone` (sans `node_modules` volumineux).
   - Tourne sous un utilisateur système non-root dédié (`nextjs:nodejs`, UID 1001).
   - Ne publie aucun port directement sur la machine hôte en production.

3. **`backend` (NestJS 11 + Prisma 7)** :
   - API métier sécurisée gérant les inscriptions, les paiements Paystack, et l'administration.
   - Tourne sous un utilisateur non-root (`node`).
   - Se connecte exclusivement à la base PostgreSQL externe via la variable `DATABASE_URL`.
   - Expose une sonde de santé native sur `GET /api/v1/health` (vérifiant la connectivité DB).

4. **PostgreSQL Externe (Non géré par Compose)** :
   - Hébergé de manière autonome sur le VPS (soit en service système systemd, soit dans un conteneur indépendant).
   - Complètement protégé : aucun service ou volume PostgreSQL n'est créé dans ce socle.

---

## 3. Fonctionnement des Trois Environnements

| Critère | Développement (`dev`) | Préproduction (`preprod`) | Production (`prod`) |
|---|---|---|---|
| **Fichier Compose** | `compose.dev.yml` | `compose.preprod.yml` | `compose.prod.yml` |
| **Fichier Env** | `.env.dev` | `.env.preprod` | `.env.prod` |
| **Mode d'exécution** | Hot reload / Montages volumes | Images conteneurisées | Images immuables taguées |
| **Ports exposés** | Front: 3000, Back: 3001 | Nginx: 8080/8443 | Nginx: 80/443 |
| **Reverse Proxy** | Optionnel (accès direct) | Inclus (validation proxy) | Inclus (SSL / Production) |
| **Swagger UI** | Activé (`/api/docs`) | Activé (`/api/docs`) | Désactivé par défaut |
| **Ressources** | Non bridées | Limitées (1 CPU / 512 Mo) | Réservées & Limitées (1.5 CPU / 1 Go) |
| **Logs** | Console standard | `json-file` (10m x 3) | `json-file` (10m x 5) |

---

## 4. Index des Guides Détaillés

Pour approfondir chaque volet opérationnel, consultez les guides suivants :
- [1. Guide de Déploiement VPS Ubuntu](vps-setup-guide.md) : Toutes les étapes de la première connexion SSH à la mise en ligne.
- [2. Connexion au PostgreSQL Externe](database-setup.md) : Comment diagnostiquer le PostgreSQL existant et connecter l'API en toute sécurité.
- [3. Environnements et Docker Compose](environments-and-compose.md) : Fonctionnement précis des fichiers Compose et des variables d'environnement.
- [4. Nginx et Sécurité SSL](nginx-and-ssl.md) : Configuration Nginx, headers, proxying et mise en place de Certbot / Let's Encrypt.
- [5. Runbook d'Exploitation](operations-and-runbook.md) : Utilisation des scripts (`deploy.sh`, `migrate.sh`, `rollback.sh`, etc.).

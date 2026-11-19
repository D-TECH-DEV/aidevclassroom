# Guide de Déploiement et d'Exploitation — Aidev Classroom

Ce dossier contient la documentation opérationnelle pour le déploiement, la sécurisation et l'exploitation de la plateforme **Aidev Classroom** avec Docker Compose.

---

## 1. Sommaire de la Documentation

1. [Architecture Globale & Rôle des Conteneurs](#2-architecture-globale--rôle-des-conteneurs)
2. [Fonctionnement des Trois Stacks Compose](#3-fonctionnement-des-trois-stacks-compose)
3. [Index des Guides Détaillés](#4-index-des-guides-détaillés)
   - [Guide de Déploiement VPS Ubuntu](vps-setup-guide.md)
   - [Configuration PostgreSQL](database-setup.md)
   - [Environnements et Fichiers Docker Compose](environments-and-compose.md)
   - [Configuration Nginx et Certificats SSL](nginx-and-ssl.md)
   - [Runbook d'Exploitation, Migrations et Rollback](operations-and-runbook.md)
4. [Rapport Global de Déploiement](../RAPPORT_DEPLOIEMENT.md)

---

## 2. Architecture Globale & Rôle des Conteneurs

Chaque environnement repose sur une stack autonome et complète incluant sa propre base PostgreSQL 16 :

```
                             TRAFIC INTERNET (Clients / Navigateurs)
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │   Nginx Reverse Proxy   │ VPS (:80/:443) ou Coolify (:80 interne)
                                 │         (proxy)         │ Routage /api/v1/ et /
                                 └────────────┬────────────┘
                                              │
                                     Réseau Docker Privé
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         ┌─────────────────────────┐                     ┌─────────────────────────┐
         │    Frontend Next.js     │                     │     Backend NestJS      │
         │       (frontend)        │                     │        (backend)        │
         │   Port interne : 3000   │                     │   Port interne : 3000   │
         │ Mode Standalone (Alpine)│                     │ Prisma ORM + Client Pg  │
         └─────────────────────────┘                     └────────────┬────────────┘
                                                                      │
                                                                      ▼
                                                         ┌─────────────────────────┐
                                                         │   PostgreSQL 16 Alpine  │
                                                         │       (postgres)        │
                                                         └─────────────────────────┘
```

### Rôle de chaque service :

1. **`proxy` (Nginx 1.27 Alpine)** :
   - Point d'entrée unique de la plateforme en production.
   - Sur VPS sans Coolify (`compose.prod.yml`), écoute sur les ports publics HTTP (`80`) et HTTPS (`443`) avec Certbot.
   - Sur Coolify (`compose.coolify.yml`), expose uniquement le port interne `80` derrière Traefik (qui gère le TLS automatique).
   - Route `/api/v1/` vers `backend:3000` et `/api/` + `/` vers `frontend:3000`.

2. **`frontend` (Next.js 16.4.2 Standalone)** :
   - Interface utilisateur et BFF `/admin` exécutés sous l'utilisateur non-root `nextjs` (UID 1001).

3. **`backend` (NestJS 11 + Prisma 7)** :
   - API métier exécutée sous l'utilisateur non-root `node`.
   - Expose `GET /api/v1/health` (incluant `SELECT 1` sur PostgreSQL).

4. **`postgres` (PostgreSQL 16 Alpine)** :
   - Service complet inclus dans chaque fichier Compose avec volume persistant dédié (`aidev-pgdata-dev`, `aidev-pgdata-prod`, `aidev-pgdata-coolify`).
   - En production (`compose.coolify.yml`), un service one-shot `migrate` exécute `npx prisma migrate deploy` avant le démarrage de `backend`.

---

## 3. Fonctionnement des Trois Stacks Compose

| Critère | Test / Préprod (`dev`) | Production VPS sans Coolify (`prod`) | Production Coolify (`coolify`) |
|---|---|---|---|
| **Fichier Compose** | `compose.dev.yml` | `compose.prod.yml` | `compose.coolify.yml` |
| **Fichier Env** | `.env.dev` | `.env.prod` | Variables dans UI Coolify (`.env.coolify.example`) |
| **Mode d'exécution** | Hot reload (profil `preprod` pour Nginx) | Images compilées taguées | Images compilées gérées par Coolify |
| **PostgreSQL** | Conteneur `aidev-postgres-dev` | Conteneur `aidev-postgres-prod` | Conteneur `postgres` + service `migrate` |
| **Ports exposés** | Front: 3000, Back: 3001 (Nginx `8080/8443`) | Nginx: `80` / `443` | Aucun port hôte (`expose: ["80"]` pour Traefik) |
| **Swagger UI** | Activé (`/api/docs`) | Désactivé par défaut | Désactivé par défaut |
| **Logs** | `json-file` (10m x 3) | `json-file` (10m x 5) | Gérés par Coolify / Docker |

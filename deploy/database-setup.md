# Connexion et Sécurisation du PostgreSQL Externe — Aidev Classroom

La plateforme Aidev Classroom se connecte à une base de données PostgreSQL **déjà existante et administrée séparément** sur votre VPS.

Ce document fournit la procédure complète pour diagnostiquer l'instance PostgreSQL existante, créer une base et un utilisateur dédiés, et configurer la connectivité réseau sans jamais compromettre votre serveur de base de données.

---

## 1. Diagnostic du PostgreSQL Existant sur le VPS

Avant de configurer la variable `DATABASE_URL`, vous devez déterminer comment votre PostgreSQL est hébergé sur le VPS.

Exécutez ces commandes de diagnostic sur le serveur :

### Test 1 : Vérifier si PostgreSQL tourne en service système natif
```bash
sudo systemctl status postgresql
# Vérifier le port d'écoute local :
sudo ss -tlpn | grep 5432
```

### Test 2 : Vérifier si PostgreSQL tourne dans un conteneur Docker séparé
```bash
docker ps --filter "ancestor=postgres" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Networks}}"
```

---

## 2. Configuration Selon le Mode d'Hébergement

### Scénario A : PostgreSQL tourne directement sur l'hôte Ubuntu (Service systemd)

Dans ce cas, PostgreSQL écoute sur la machine hôte.

1. **Autoriser l'écoute sur l'interface réseau Docker** :
   Dans `/etc/postgresql/<version>/main/postgresql.conf` :
   ```ini
   listen_addresses = 'localhost, 172.17.0.1'  # Ou '*' si le pare-feu UFW protège le port 5432
   ```

2. **Autoriser la plage IP Docker dans `pg_hba.conf`** :
   Dans `/etc/postgresql/<version>/main/pg_hba.conf` :
   ```
   # Autoriser le sous-réseau Docker (par défaut 172.17.0.0/16) avec mot de passe chiffré (scram-sha-256)
   host    aidev_db        aidev_user      172.16.0.0/12           scram-sha-256
   ```
   Puis recharger PostgreSQL :
   ```bash
   sudo systemctl reload postgresql
   ```

3. **Format de la variable `DATABASE_URL` dans `.env.prod`** :
   Le fichier `compose.prod.yml` intègre la directive `extra_hosts: ["host.docker.internal:host-gateway"]`.
   Vous pouvez donc renseigner :
   ```env
   DATABASE_URL="postgresql://aidev_user:VOTRE_MOT_DE_PASSE@host.docker.internal:5432/aidev_db?schema=public"
   ```
   *(Alternativement, vous pouvez remplacer `host.docker.internal` par l'IP de la passerelle Docker `172.17.0.1`)*.

---

### Scénario B : PostgreSQL tourne dans un conteneur Docker séparé

Dans ce cas, votre conteneur PostgreSQL appartient déjà à un réseau Docker existant sur le VPS.

1. **Identifier le réseau du conteneur PostgreSQL** :
   ```bash
   docker inspect <NOM_CONTENEUR_PG> --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
   ```
   *Exemple de résultat : `vps-internal-net` ou `bridge`.*

2. **Connexion réseau** :
   - **Option 1 (Recommandée - Même réseau Docker)** : Vous pouvez connecter le conteneur API au réseau existant de PostgreSQL :
     ```bash
     docker network connect <NOM_DU_RESEAU_PG> aidev-api-prod
     ```
     Dans ce cas, le nom du conteneur sert de DNS interne :
     ```env
     DATABASE_URL="postgresql://aidev_user:VOTRE_MOT_DE_PASSE@NOM_CONTENEUR_PG:5432/aidev_db?schema=public"
     ```
   - **Option 2 (Via passerelle Docker)** : Si le conteneur PostgreSQL publie son port 5432 sur l'hôte (ex: `127.0.0.1:5432:5432`), utilisez `host.docker.internal:5432`.

---

## 3. Création de la Base et de l'Utilisateur Dédiés (Principe du Moindre Privilège)

Ne réutilisez **JAMAIS** le super-utilisateur `postgres` pour l'application. Créez un utilisateur et une base dédiés et étanches :

Connectez-vous à la console PostgreSQL :
```bash
# Si service systemd :
sudo -u postgres psql

# Si conteneur Docker :
docker exec -it <NOM_CONTENEUR_PG> psql -U postgres
```

Exécutez les instructions SQL suivantes :
```sql
-- 1. Générer un mot de passe fort (ex: openssl rand -base64 32)
CREATE USER aidev_user WITH PASSWORD 'MOT_DE_PASSE_TRES_FORT_GENERE';

-- 2. Création de la base dédiée appartenant à cet utilisateur
CREATE DATABASE aidev_db OWNER aidev_user;

-- 3. Connexion à la base créée
\c aidev_db

-- 4. Attribution des privilèges stricts sur le schéma public
GRANT ALL PRIVILEGES ON SCHEMA public TO aidev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO aidev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO aidev_user;

-- 5. Quitter
\q
```

---

## 4. Sauvegarde Préventive et Restauration (Runbook SRE)

Avant toute opération de migration ou de mise à jour, effectuez **toujours** une sauvegarde de la base de données.

### Sauvegarde (`pg_dump`)
```bash
# Sauvegarde au format binaire compressé custom (-Fc)
mkdir -p /root/backups
docker exec <NOM_CONTENEUR_PG> pg_dump -U postgres -Fc aidev_db > /root/backups/aidev_db-$(date +%F_%H%M%S).dump

# Ou si PostgreSQL est natif sur l'hôte :
sudo -u postgres pg_dump -Fc aidev_db > /root/backups/aidev_db-$(date +%F_%H%M%S).dump
```

### Restauration d'urgence (`pg_restore`)
En cas d'incident nécessitant un retour en arrière sur les données :
```bash
# Restauration dans une base de vérification préalable (recommandé) :
sudo -u postgres createdb aidev_restore
sudo -u postgres pg_restore -d aidev_restore /root/backups/aidev_db-DATE.dump
```

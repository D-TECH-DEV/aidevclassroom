# Guide de Déploiement sur un VPS Ubuntu — Aidev Classroom

Ce guide détaille pas à pas les opérations à exécuter lors de la première connexion à votre serveur VPS Ubuntu pour installer et démarrer la plateforme Aidev Classroom.

---

## 1. Opérations Préliminaires sur le VPS (Première Connexion)

Connectez-vous à votre VPS en SSH :
```bash
ssh utilisateur@IP_DE_VOTRE_VPS
```

### Étape 1.1 — Mise à jour du système
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw apt-transport-https ca-certificates gnupg lsb-release
```

### Étape 1.2 — Configuration du Pare-feu UFW
Sécurisez les accès réseau du VPS en ouvrant uniquement les flux indispensables :
```bash
# Ne jamais couper la connexion SSH
sudo ufw allow OpenSSH

# Flux Web pour le Reverse Proxy Nginx
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Activation du pare-feu
sudo ufw enable
sudo ufw status verbose
```
> **Règle de sécurité SRE** : Le port PostgreSQL (5432) ne doit **JAMAIS** être ouvert publiquement sur Internet. La communication avec la base de données se fait exclusivement en local ou via le réseau Docker privé.

### Étape 1.3 — Installation de Docker Engine et Docker Compose v2
Si Docker n'est pas encore présent sur le VPS :
```bash
# Clé GPG officielle Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Dépôt officiel Docker Ubuntu
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installation
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Autorisation de l'utilisateur sans sudo
sudo usermod -aG docker $USER
newgrp docker

# Vérification
docker --version
docker compose version
```

---

## 2. Déploiement du Code Source sur le VPS

Clonez votre dépôt Git dans le répertoire de votre choix (ex: `/srv/aidevclassroom` ou `/home/ubuntu/aidevclassroom`) :
```bash
git clone <URL_DE_VOTRE_DEPOT_GIT> /srv/aidevclassroom
cd /srv/aidevclassroom
```

Assurez-vous que les scripts sont bien exécutables :
```bash
chmod +x scripts/*.sh
```

---

## 3. Configuration des Variables d'Environnement de Production

Créez le fichier `.env.prod` à partir du fichier modèle :
```bash
cp .env.prod.example .env.prod
chmod 600 .env.prod  # Protection en lecture/écriture stricte pour le propriétaire
```

Éditez `.env.prod` avec votre éditeur favori (`nano .env.prod` ou `vim .env.prod`) :
1. Renseignez vos noms de domaine réels (`DOMAIN_NAME`, `API_DOMAIN_NAME`).
2. Définissez `DATABASE_URL` en pointant vers votre PostgreSQL externe existant (voir [deploy/database-setup.md](database-setup.md)).
3. Générez un secret JWT fort :
   ```bash
   openssl rand -base64 48
   ```
4. Indiquez votre clé Paystack **Live** (`sk_live_...`) et vos URLs de retour.
5. Vérifiez que `SWAGGER_ENABLED=false` en production.

---

## 4. Premier Lancement de la Plateforme

### Étape 4.1 — Exécuter le déploiement complet
Le script `scripts/deploy.sh` construit les images, applique les migrations initiales et démarre l'ensemble des services :
```bash
./scripts/deploy.sh prod --with-migrations
```

### Étape 4.2 — Vérification de l'état des conteneurs
```bash
./scripts/status.sh prod
```
Tous les conteneurs (`aidev-proxy-prod`, `aidev-frontend-prod`, `aidev-api-prod`) doivent afficher un statut `healthy`.

### Étape 4.3 — Création du premier compte Administrateur (Optionnel)
Pour créer votre compte administrateur initial via la CLI sécurisée NestJS :
```bash
docker compose -f compose.prod.yml --env-file .env.prod run --rm backend npm run admin:create -- admin@votre-domaine.com "Votre Nom" "VotreMotDePasseFort"
```

---

## 5. Mise en Place du HTTPS avec Let's Encrypt

Suivez les instructions du guide [deploy/nginx-and-ssl.md](nginx-and-ssl.md) pour générer vos certificats SSL gratuits via Certbot et activer le protocole HTTPS sécurisé.

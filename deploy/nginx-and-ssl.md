# Configuration Nginx et Sécurité SSL (Let's Encrypt) — Aidev Classroom

Ce document détaille le fonctionnement du reverse proxy Nginx, les règles de routage HTTP, les en-têtes de sécurité et la procédure d'activation HTTPS avec Let's Encrypt.

---

## 1. Rôle et Architecture du Reverse Proxy Nginx

En production et préproduction, Nginx (`nginx:1.27-alpine`) agit comme le bouclier et le répartiteur de requêtes HTTP/HTTPS :
- **Point d'entrée unique** : écoute sur les ports 80 et 443.
- **Routage intelligent** :
  - Les requêtes préfixées par `/api/` sont transmises au conteneur `backend:3000`.
  - Toutes les autres requêtes sont transmises au conteneur `frontend:3000`.
- **Support des WebSockets** : maintien des connexions persistantes pour Next.js et les flux temps réel.
- **Protection DoS & Buffering** : limitation de la taille du corps de requête à 25 Mo (`client_max_body_size 25M`) et timeouts ajustés à 60s pour éviter l'épuisement des sockets.

---

## 2. En-têtes de Proxying Transmis aux Applications

Nginx injecte les en-têtes indispensables pour que NestJS et Next.js identifient correctement l'adresse IP et le protocole du client :

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;
```

Ces en-têtes sont cruciaux pour :
- La validation des origines CORS dans NestJS.
- La détection de connexions sécurisées HTTPS par les cookies de session Next.js (`secure: true`).
- Les mécanismes de limitation de débit (`ThrottlerGuard` dans NestJS) basés sur l'adresse IP réelle de l'utilisateur et non celle du proxy.

---

## 3. Mise en Place du HTTPS avec Let's Encrypt / Certbot (Sans Certificats Fictifs)

Conformément aux bonnes pratiques SRE, **aucun faux certificat auto-signé n'a été inséré dans le dépôt**. La configuration Nginx est pré-équipée pour valider le défi ACME HTTP-01 de l'autorité Let's Encrypt.

### Étape 3.1 — Prérequis DNS
Assurez-vous que vos enregistrements DNS (Type A) pointent bien vers l'adresse IP publique de votre VPS :
- `classroom.votre-domaine.com` -> `IP_VPS`
- `api.classroom.votre-domaine.com` (si sous-domaine dédié) -> `IP_VPS`

### Étape 3.2 — Démarrer la stack HTTP initiale
Lancez les conteneurs en HTTP (port 80) :
```bash
./scripts/start.sh prod proxy
```
Nginx répond sur le port 80 et expose le dossier `/var/www/certbot` pour le challenge ACME.

### Étape 3.3 — Obtenir les certificats avec Certbot en mode webroot
Exécutez Certbot via un conteneur éphémère ou directement sur l'hôte :

```bash
docker run -it --rm --name certbot \
  -v aidev-certbot-etc:/etc/letsencrypt \
  -v aidev-certbot-var:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email votre-email@domaine.com \
  --agree-tos \
  --no-eff-email \
  -d classroom.votre-domaine.com \
  -d api.classroom.votre-domaine.com
```

### Étape 3.4 — Activer le bloc SSL dans Nginx
Une fois les certificats générés dans `/etc/letsencrypt/live/classroom.votre-domaine.com/` :
1. Ouvrez `nginx/conf.d/default.conf`.
2. Décommentez le bloc `server { listen 443 ssl ... }`.
3. Adaptez le nom de domaine de votre certificat.
4. Rechargez la configuration Nginx à chaud sans coupure de service :
   ```bash
   docker exec aidev-proxy-prod nginx -s reload
   ```

### Étape 3.5 — Renouvellement Automatique
Let's Encrypt délivre des certificats valables 90 jours. Ajoutez une tâche cron sur votre VPS Ubuntu (`crontab -e`) pour tester le renouvellement chaque semaine :
```cron
0 3 * * 1 docker run --rm -v aidev-certbot-etc:/etc/letsencrypt -v aidev-certbot-var:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker exec aidev-proxy-prod nginx -s reload
```

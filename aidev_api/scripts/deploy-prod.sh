#!/bin/sh
# Deploiement controle aidev_api en production (VPS).
# Usage : PROXY_NETWORK=<reseau-reel> API_VERSION=<tag> sh scripts/deploy-prod.sh
# Ne detruit rien : pas de `down -v`, pas de suppression de volume/reseau.
set -eu

COMPOSE="docker compose -f docker-compose.prod.yml"
: "${PROXY_NETWORK:?PROXY_NETWORK manquant : renseignez le reseau Docker reel (voir docs/prod-deploy.md).}"

if [ ! -f .env.prod ]; then
  echo "ERREUR : .env.prod introuvable (non versionne, voir .env.example)." >&2
  exit 1
fi

echo "== 1/4 build image =="
$COMPOSE build

echo "== 2/4 migrations (one-shot, avant l'API) =="
$COMPOSE run --rm migrate

echo "== 3/4 demarrage API =="
$COMPOSE up -d api

echo "== 4/4 attente sante (120 s max) =="
for i in $(seq 1 24); do
  STATUS=$($COMPOSE ps --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)
  echo "tentative $i : $STATUS"
  case "$STATUS" in
    *healthy*) echo "API saine."; $COMPOSE logs --tail=20 api; exit 0 ;;
  esac
  sleep 5
done
echo "ERREUR : API non saine apres 120 s. Logs :" >&2
$COMPOSE logs --tail=50 api >&2
echo "Rollback : voir docs/prod-deploy.md (image precedente + restauration pg_dump)." >&2
exit 1

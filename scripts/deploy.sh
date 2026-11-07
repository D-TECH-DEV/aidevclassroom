#!/usr/bin/env bash
# ==============================================================================
# Script Principal de Déploiement — Aidev Classroom
# Usage : ./scripts/deploy.sh [dev|preprod|prod] [--with-migrations]
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

check_prerequisites

TARGET_ENV="${1:-}"
OPTION="${2:-}"

resolve_env "$TARGET_ENV"

DEPLOY_TAG="$(date +%Y%m%d-%H%M%S)"
export API_VERSION="${API_VERSION:-$DEPLOY_TAG}"
export FRONTEND_VERSION="${FRONTEND_VERSION:-$DEPLOY_TAG}"

echo ""
log_info "=================================================================="
log_info " Déploiement de la plateforme Aidev Classroom — [${ENV_NAME}]"
log_info " Tag de version : ${API_VERSION}"
log_info " Fichier Compose : $(basename "$COMPOSE_FILE")"
log_info " Fichier Env : $(basename "$ENV_FILE")"
log_info "=================================================================="
echo ""

# Étape 1 : Construction des images
log_info "== [1/4] Construction des images Docker =="
$DOCKER_COMPOSE build

# Étape 2 : Migrations explicites de la base de données (si demandées ou nécessaires)
if [[ "$OPTION" == "--with-migrations" ]]; then
    log_info "== [2/4] Exécution explicite des migrations Prisma =="
    "${SCRIPT_DIR}/migrate.sh" "$TARGET_ENV"
else
    log_info "== [2/4] Migrations non exécutées (--with-migrations non spécifié) =="
    log_info "Pour exécuter les migrations manuellement : ./scripts/migrate.sh ${ENV_NAME}"
fi

# Étape 3 : Démarrage des conteneurs
log_info "== [3/4] Démarrage des services =="
$DOCKER_COMPOSE up -d

# Étape 4 : Vérification de santé (Attente jusqu'à 90s)
log_info "== [4/4] Attente de la validation des Healthchecks (90s max) =="

MAX_WAIT=90
INTERVAL=5
ELAPSED=0

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
    UNHEALTHY_OR_STARTING=0
    CONTAINERS=$($DOCKER_COMPOSE ps -q)

    for cid in $CONTAINERS; do
        HEALTH=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")
        if [[ "$HEALTH" == "starting" || "$HEALTH" == "unhealthy" ]]; then
            UNHEALTHY_OR_STARTING=1
            break
        fi
    done

    if [[ $UNHEALTHY_OR_STARTING -eq 0 ]]; then
        echo ""
        log_success "Tous les services sont sains et opérationnels !"
        "${SCRIPT_DIR}/status.sh" "$TARGET_ENV"
        exit 0
    fi

    echo -n "."
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

echo ""
log_warn "Le délai d'attente des healthchecks a expiré (${MAX_WAIT}s)."
log_warn "Affichage des derniers logs pour diagnostic :"
$DOCKER_COMPOSE logs --tail=40
"${SCRIPT_DIR}/status.sh" "$TARGET_ENV"
exit 1

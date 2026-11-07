#!/usr/bin/env bash
# ==============================================================================
# État des services et contrôles de santé — Aidev Classroom
# Usage : ./scripts/status.sh [dev|preprod|prod]
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

check_prerequisites

TARGET_ENV="${1:-}"
resolve_env "$TARGET_ENV"

echo ""
log_info "=================================================="
log_info " État des conteneurs — Environnement [${ENV_NAME}]"
log_info "=================================================="
$DOCKER_COMPOSE ps -a

echo ""
log_info "Vérification détaillée des Healthchecks..."
CONTAINERS=$($DOCKER_COMPOSE ps -q)

if [[ -z "$CONTAINERS" ]]; then
    log_warn "Aucun conteneur actif pour l'environnement [${ENV_NAME}]."
    exit 0
fi

for cid in $CONTAINERS; do
    CNAME=$(docker inspect --format '{{.Name}}' "$cid" | sed 's/^\///')
    STATUS=$(docker inspect --format '{{.State.Status}}' "$cid")
    HEALTH=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}pas de healthcheck{{end}}' "$cid")
    
    if [[ "$HEALTH" == "healthy" ]]; then
        echo -e "  - ${CNAME} : [${STATUS}] -> ${GREEN}${HEALTH}${NC}"
    elif [[ "$HEALTH" == "unhealthy" ]]; then
        echo -e "  - ${CNAME} : [${STATUS}] -> ${RED}${HEALTH}${NC}"
    elif [[ "$HEALTH" == "starting" ]]; then
        echo -e "  - ${CNAME} : [${STATUS}] -> ${YELLOW}${HEALTH}${NC}"
    else
        echo -e "  - ${CNAME} : [${STATUS}] -> ${CYAN}${HEALTH}${NC}"
    fi
done
echo ""

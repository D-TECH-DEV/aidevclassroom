#!/usr/bin/env bash
# ==============================================================================
# Redémarrage des services — Aidev Classroom
# Usage : ./scripts/restart.sh [dev|preprod|prod] [service_optionnel]
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

check_prerequisites

TARGET_ENV="${1:-}"
SERVICE="${2:-}"

resolve_env "$TARGET_ENV"

log_info "Redémarrage des services pour l'environnement [${ENV_NAME}]..."

if [[ -n "$SERVICE" ]]; then
    log_info "Redémarrage du service spécifique : ${SERVICE}"
    $DOCKER_COMPOSE restart "$SERVICE"
else
    $DOCKER_COMPOSE restart
fi

log_success "Redémarrage effectué."
"${SCRIPT_DIR}/status.sh" "$TARGET_ENV"

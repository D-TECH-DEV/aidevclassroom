#!/usr/bin/env bash
# ==============================================================================
# Démarrage des services — Aidev Classroom
# Usage : ./scripts/start.sh [dev|preprod|prod] [service_optionnel]
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

check_prerequisites

TARGET_ENV="${1:-}"
SERVICE="${2:-}"

resolve_env "$TARGET_ENV"

log_info "Démarrage des services pour l'environnement [${ENV_NAME}]..."
log_info "Fichier Compose : $(basename "$COMPOSE_FILE")"

if [[ -n "$SERVICE" ]]; then
    log_info "Démarrage du service spécifique : ${SERVICE}"
    $DOCKER_COMPOSE up -d "$SERVICE"
else
    $DOCKER_COMPOSE up -d
fi

log_success "Services démarrés pour [${ENV_NAME}]."
"${SCRIPT_DIR}/status.sh" "$TARGET_ENV"

#!/usr/bin/env bash
# ==============================================================================
# Construction des images Docker — Aidev Classroom
# Usage : ./scripts/build.sh [dev|preprod|prod] [service_optionnel]
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

check_prerequisites

TARGET_ENV="${1:-}"
SERVICE="${2:-}"

resolve_env "$TARGET_ENV"

log_info "Construction des images pour l'environnement [${ENV_NAME}]..."
log_info "Fichier Compose : $(basename "$COMPOSE_FILE")"
log_info "Fichier d'environnement : $(basename "$ENV_FILE")"

if [[ -n "$SERVICE" ]]; then
    log_info "Cible spécifique : ${SERVICE}"
    $DOCKER_COMPOSE build "$SERVICE"
else
    log_info "Construction de tous les services..."
    $DOCKER_COMPOSE build
fi

log_success "Construction terminée avec succès pour [${ENV_NAME}]."

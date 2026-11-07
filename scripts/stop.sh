#!/usr/bin/env bash
# ==============================================================================
# Arrêt des services — Aidev Classroom
# Usage : ./scripts/stop.sh [dev|preprod|prod]
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

check_prerequisites

TARGET_ENV="${1:-}"
resolve_env "$TARGET_ENV"

log_info "Arrêt des services pour l'environnement [${ENV_NAME}]..."
log_info "Fichier Compose : $(basename "$COMPOSE_FILE")"

# Arrêt sans destruction de volumes ni de données
$DOCKER_COMPOSE down

log_success "Services arrêtés proprement pour [${ENV_NAME}]."

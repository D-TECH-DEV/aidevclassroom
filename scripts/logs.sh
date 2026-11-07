#!/usr/bin/env bash
# ==============================================================================
# Consultation des journaux (logs) — Aidev Classroom
# Usage : ./scripts/logs.sh [dev|preprod|prod] [service_optionnel] [options...]
# Exemple : ./scripts/logs.sh prod backend -f
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

check_prerequisites

TARGET_ENV="${1:-}"
shift || true

resolve_env "$TARGET_ENV"

log_info "Affichage des logs pour l'environnement [${ENV_NAME}]..."
$DOCKER_COMPOSE logs "$@"

#!/usr/bin/env bash
# ==============================================================================
# Procédure de Rollback Applicatif — Aidev Classroom
# Usage : ./scripts/rollback.sh [dev|preprod|prod] [TAG_API] [TAG_FRONTEND]
#   TAG_FRONTEND est optionnel (defaut : meme valeur que TAG_API).
#   Mode non interactif (CI) : ROLLBACK_AUTO_CONFIRM=oui dans l'environnement.
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

check_prerequisites

TARGET_ENV="${1:-}"
ROLLBACK_TAG="${2:-}"
ROLLBACK_FRONT_TAG="${3:-$ROLLBACK_TAG}"

resolve_env "$TARGET_ENV"

echo ""
log_warn "=================================================================="
log_warn " PROCÉDURE DE ROLLBACK APPLICATIF — [${ENV_NAME}]"
log_warn "=================================================================="
log_warn "Note importante SRE/DevOps :"
log_warn "1. Ce script effectue un rollback applicatif (conteneurs et images)."
log_warn "2. Les migrations de base de données Prisma NE sont PAS automatiquement"
log_warn "   annulées (toute modification de schéma nécessite une migration"
log_warn "   corrective ou une restauration manuelle via 'pg_restore')."
log_warn "=================================================================="
echo ""

if [[ -z "$ROLLBACK_TAG" ]]; then
    log_error "Veuillez spécifier le tag ou la version vers laquelle effectuer le rollback."
    log_info "Exemple d'usage : $0 ${ENV_NAME} 20261105-1200"
    log_info "Images disponibles localement :"
    docker images --filter=reference="aidev-api:*" --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}"
    exit 1
fi

if [[ "${ROLLBACK_AUTO_CONFIRM:-}" != "oui" ]]; then
    read -r -p "Confirmez-vous le retour vers la version '${ROLLBACK_TAG}' pour [${ENV_NAME}] ? (oui/non) : " confirmation
    if [[ "$confirmation" != "oui" ]]; then
        log_warn "Rollback annulé par l'opérateur."
        exit 0
    fi
else
    log_warn "ROLLBACK_AUTO_CONFIRM=oui : retour arriere sans invite (mode CI)."
fi

log_info "Application des tags versionnés : API_VERSION=${ROLLBACK_TAG} FRONTEND_VERSION=${ROLLBACK_FRONT_TAG}"
export API_VERSION="${ROLLBACK_TAG}"
export FRONTEND_VERSION="${ROLLBACK_FRONT_TAG}"

log_info "Redéploiement des services avec les images versionnées..."
$DOCKER_COMPOSE up -d --no-build

log_success "Rollback applicatif effectué."
"${SCRIPT_DIR}/status.sh" "$TARGET_ENV"

#!/usr/bin/env bash
# ==============================================================================
# Exécution explicite des migrations Prisma — Aidev Classroom
# Usage : ./scripts/migrate.sh [dev|preprod|prod] [--seed]
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

check_prerequisites

TARGET_ENV="${1:-}"
SEED_FLAG="${2:-}"

resolve_env "$TARGET_ENV"

echo ""
log_warn "=================================================================="
log_warn " ATTENTION : Exécution explicite des migrations de schéma Prisma"
log_warn " Environnement ciblé : [${ENV_NAME}]"
log_warn " Base externe définie dans : $(basename "$ENV_FILE")"
log_warn "=================================================================="
echo ""

if [[ "$ENV_NAME" == "prod" ]]; then
    log_info "Rappel Production : Avez-vous effectué une sauvegarde de la base externe (pg_dump) ?"
    read -r -p "Confirmez-vous l'application des migrations sur la base de production ? (oui/non) : " confirmation
    if [[ "$confirmation" != "oui" ]]; then
        log_warn "Opération annulée par l'opérateur."
        exit 0
    fi
fi

log_info "Exécution de 'npx prisma migrate deploy' via un conteneur éphémère backend..."
$DOCKER_COMPOSE run --rm --no-deps backend npx prisma migrate deploy

log_success "Migrations appliquées avec succès sur la base de données [${ENV_NAME}]."

if [[ "$SEED_FLAG" == "--seed" ]]; then
    log_info "Option --seed détectée : Exécution du script de seed Prisma..."
    $DOCKER_COMPOSE run --rm --no-deps backend npm run prisma:seed
    log_success "Seeding terminé avec succès."
fi

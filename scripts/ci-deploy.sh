#!/usr/bin/env bash
# ==============================================================================
# Deploiement non interactif — Aidev Classroom (production, VPS)
# Usage : ./scripts/ci-deploy.sh prod
# Concu pour GitHub Actions (aucune invite). En local, preferez
# ./scripts/deploy.sh (interactif, avec garde-fous).
#
# Deroulement :
#   1. Memorise les images en cours (pour un eventuel retour arriere).
#   2. Construit les images depuis le code deje mis a jour (git reset).
#   3. Applique `prisma migrate deploy` (idempotent, jamais de seed auto).
#   4. Redemarre via `up -d` (seuls les services modifies sont recrees).
#   5. Attend les healthchecks puis verifie le HTTP reel (proxy+Nginx).
#   6. En cas d'echec : retour arriere applicatif NON interactif vers les
#      images precedentes, reverification, sortie en erreur explicite.
#
# PostgreSQL reste externe : aucun service PG ici, aucun volume touche,
# aucune commande destructive (pas de `down -v`, pas de `prune --volumes`).
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

check_prerequisites

TARGET_ENV="${1:-prod}"
resolve_env "$TARGET_ENV"

if [[ "$ENV_NAME" != "prod" ]]; then
    log_error "ci-deploy.sh ne deploie qu'en production (recu : '${TARGET_ENV}')."
    exit 1
fi

HTTP_PORT="$(grep -E '^HTTP_PORT=' "$ENV_FILE" | cut -d= -f2 || true)"
HTTP_PORT="${HTTP_PORT:-8081}"
BASE_URL="http://127.0.0.1:${HTTP_PORT}"

# -- Images precedentes (retour arriere) --------------------------------------
PREV_API_TAG="$(docker inspect aidev-api-prod --format '{{.Config.Image}}' 2>/dev/null | cut -d: -f2 || true)"
PREV_FRONT_TAG="$(docker inspect aidev-frontend-prod --format '{{.Config.Image}}' 2>/dev/null | cut -d: -f2 || true)"
log_info "Images en cours : API=${PREV_API_TAG:-aucune} FRONT=${PREV_FRONT_TAG:-aucune}"

rollback_si_echec() {
    log_error "Deploiement en echec : tentative de retour arriere applicatif."
    if [[ -z "${PREV_API_TAG:-}" || -z "${PREV_FRONT_TAG:-}" ]]; then
        log_error "ROLLBACK_IMPOSSIBLE : aucune image precedente memorisee."
        "${SCRIPT_DIR}/status.sh" prod || true
        exit 1
    fi
    export ROLLBACK_AUTO_CONFIRM=oui
    log_warn "Note : un retour arriere applicatif n'annule PAS d'eventuelles migrations"
    log_warn "Prisma deja appliquees (voir scripts/rollback.sh) : prevoyez une migration"
    log_warn "corrective ou une restauration si le schema a change."
    if "${SCRIPT_DIR}/rollback.sh" prod "$PREV_API_TAG" "$PREV_FRONT_TAG"; then
        log_info "Retour arriere effectue vers API=${PREV_API_TAG} FRONT=${PREV_FRONT_TAG}."
        if verification_http; then
            log_success "ROLLBACK_OK : services revenus sains sur la version precedente."
        else
            log_error "ROLLBACK_PARTIEL : version precedente restauree mais verification HTTP en echec."
        fi
    else
        log_error "ROLLBACK_ECHEC : le retour arriere n'a pas pu s'appliquer."
    fi
    "${SCRIPT_DIR}/status.sh" prod || true
    exit 1
}

verification_http() {
    log_info "Verification HTTP reelle sur ${BASE_URL} ..."
    curl -fsS --max-time 10 "${BASE_URL}/healthz" | grep -q healthy \
        || { log_error "Echec HTTP : /healthz du proxy."; return 1; }
    curl -fsS --max-time 15 "${BASE_URL}/" > /dev/null \
        || { log_error "Echec HTTP : page du frontend."; return 1; }
    curl -fsS --max-time 15 "${BASE_URL}/api/v1/health" | grep -q '"status":"ok"' \
        || { log_error "Echec HTTP : /api/v1/health du backend."; return 1; }
    log_success "HTTP OK : proxy, frontend et API repondent."
    return 0
}

# -- Deploiement (build + migrations + up + healthchecks) ---------------------
export MIGRATE_AUTO_CONFIRM=oui
if ! "${SCRIPT_DIR}/deploy.sh" prod --with-migrations; then
    rollback_si_echec
fi

# -- Verification HTTP reelle (le healthcheck Docker ne suffit pas) ------------
if ! verification_http; then
    rollback_si_echec
fi

log_success "Deploiement production termine et verifie."
"${SCRIPT_DIR}/status.sh" prod

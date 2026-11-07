#!/usr/bin/env bash
# ==============================================================================
# Helper commun pour les scripts d'exploitation d'Aidev Classroom
# ==============================================================================
set -Eeuo pipefail

# Couleurs pour l'affichage console
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

# Racine du projet (dossier parent du dossier scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Vérification des prérequis système
check_prerequisites() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé ou n'est pas accessible dans le PATH."
        exit 1
    fi

    if ! docker compose version &> /dev/null; then
        log_error "Le plugin 'docker compose' (v2) n'est pas installé."
        exit 1
    fi
}

# Validation de l'environnement passé en argument
# Valeurs acceptées : dev, preprod, prod
resolve_env() {
    local target_env="${1:-}"

    if [[ -z "$target_env" ]]; then
        log_error "Environnement non spécifié. Usage : $0 [dev|preprod|prod]"
        exit 1
    fi

    case "$target_env" in
        dev)
            COMPOSE_FILE="${ROOT_DIR}/compose.dev.yml"
            ENV_FILE="${ROOT_DIR}/.env.dev"
            ENV_NAME="dev"
            ;;
        preprod)
            COMPOSE_FILE="${ROOT_DIR}/compose.preprod.yml"
            ENV_FILE="${ROOT_DIR}/.env.preprod"
            ENV_NAME="preprod"
            ;;
        prod)
            COMPOSE_FILE="${ROOT_DIR}/compose.prod.yml"
            ENV_FILE="${ROOT_DIR}/.env.prod"
            ENV_NAME="prod"
            ;;
        *)
            log_error "Environnement invalide : '$target_env'. Choisissez 'dev', 'preprod' ou 'prod'."
            exit 1
            ;;
    esac

    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Fichier Compose introuvable : $COMPOSE_FILE"
        exit 1
    fi

    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Fichier d'environnement introuvable : $ENV_FILE"
        log_warn "Veuillez copier le fichier d'exemple correspondant (ex: cp .env.${ENV_NAME}.example .env.${ENV_NAME}) et renseigner vos variables."
        exit 1
    fi

    export COMPOSE_FILE
    export ENV_FILE
    export ENV_NAME

    # Commande Compose de référence avec sélection explicite
    DOCKER_COMPOSE="docker compose --project-directory ${ROOT_DIR} -f ${COMPOSE_FILE} --env-file ${ENV_FILE}"
}

#!/usr/bin/env bash
# ==============================================================================
# Sauvegarde PostgreSQL compressée — Aidev Classroom (production)
# Usage : ./scripts/backup-db.sh
# Variables optionnelles :
#   BACKUP_DIR     : dossier cible (défaut ./backups)
#   RETENTION_DAYS : durée de conservation en jours (défaut 14)
#   ENV_FILE       : fichier d'environnement (défaut .env.prod)
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

read_env_var() {
  local key="$1"
  local default_val="$2"
  if [[ -f "$ENV_FILE" ]]; then
    local val
    val="$(grep -E "^${key}=" "$ENV_FILE" | head -n 1 | cut -d= -f2- || true)"
    val="${val%\"}"
    val="${val#\"}"
    val="${val%\'}"
    val="${val#\'}"
    if [[ -n "$val" ]]; then
      printf '%s' "$val"
      return
    fi
  fi
  printf '%s' "$default_val"
}

PG_USER="$(read_env_var POSTGRES_USER aidev_user)"
PG_DB="$(read_env_var POSTGRES_DB aidev_db)"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/aidev_db_${STAMP}.sql.gz"

echo "Sauvegarde PostgreSQL (${PG_DB}) vers ${OUT_FILE}..."
docker compose --env-file "$ENV_FILE" -f compose.prod.yml exec -T postgres \
  pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner --no-acl | gzip -9 > "$OUT_FILE"

if [[ ! -s "$OUT_FILE" ]]; then
  echo "ERREUR : le fichier de sauvegarde est vide : ${OUT_FILE}" >&2
  rm -f "$OUT_FILE"
  exit 1
fi

find "$BACKUP_DIR" -type f -name 'aidev_db_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete
echo "Sauvegarde terminee ($(du -h "$OUT_FILE" | cut -f1))."

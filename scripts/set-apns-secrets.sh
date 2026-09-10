#!/usr/bin/env bash
# Set APNS credentials in SSM and redeploy ECS.
set -euo pipefail

ENV="${1:?usage: set-apns-secrets.sh staging|production [--no-redeploy]}"
NO_REDEPLOY=false
if [[ "${2:-}" == "--no-redeploy" ]]; then
  NO_REDEPLOY=true
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/ssm-parameters.sh"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

APNS_KEY_ID="${APNS_KEY_ID:-}"
APNS_TEAM_ID="${APNS_TEAM_ID:-}"
APNS_BUNDLE_ID="${APNS_BUNDLE_ID:-live.logmaster.app}"

if [[ -z "$APNS_KEY_ID" || -z "$APNS_TEAM_ID" ]]; then
  echo "Set APNS_KEY_ID and APNS_TEAM_ID in .env or the environment." >&2
  exit 1
fi

if [[ -n "${APNS_KEY:-}" ]]; then
  KEY="$APNS_KEY"
elif [[ -n "${APNS_KEY_PATH:-}" ]]; then
  KEY_PATH="$APNS_KEY_PATH"
  if [[ "$KEY_PATH" != /* ]]; then
    KEY_PATH="$ROOT/$KEY_PATH"
  fi
  if [[ ! -f "$KEY_PATH" ]]; then
    echo "APNS key file not found: $KEY_PATH" >&2
    exit 1
  fi
  KEY="$(cat "$KEY_PATH")"
else
  echo "Set APNS_KEY (inline .p8 contents) or APNS_KEY_PATH in .env or the environment." >&2
  exit 1
fi

PREFIX="$(ssm_env_prefix "$ENV")"
ssm_put_secure "${PREFIX}/APNS_KEY" "$KEY"
ssm_put_secure "${PREFIX}/APNS_KEY_ID" "$APNS_KEY_ID"
ssm_put_secure "${PREFIX}/APNS_TEAM_ID" "$APNS_TEAM_ID"
ssm_put_secure "${PREFIX}/APNS_BUNDLE_ID" "$APNS_BUNDLE_ID"
echo "Updated ${PREFIX}/APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID."

if [[ "$NO_REDEPLOY" == "true" ]]; then
  exit 0
fi

force_ecs_redeploy "$ENV"

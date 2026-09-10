#!/usr/bin/env bash
# Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in SSM and redeploy ECS.
set -euo pipefail

ENV="${1:?usage: set-google-oauth-secrets.sh staging|production [--no-redeploy]}"
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

if [[ -z "${GOOGLE_CLIENT_ID:-}" || -z "${GOOGLE_CLIENT_SECRET:-}" ]]; then
  echo "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env or the environment." >&2
  exit 1
fi

PREFIX="$(ssm_env_prefix "$ENV")"
ssm_put_secure "${PREFIX}/GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
ssm_put_secure "${PREFIX}/GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"
echo "Updated ${PREFIX}/GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."

if [[ "$NO_REDEPLOY" == "true" ]]; then
  exit 0
fi

force_ecs_redeploy "$ENV"

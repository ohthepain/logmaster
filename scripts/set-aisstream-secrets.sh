#!/usr/bin/env bash
# Set AISSTREAM_API_KEY in SSM and redeploy ECS.
set -euo pipefail

ENV="${1:?usage: set-aisstream-secrets.sh staging|production [--no-redeploy]}"
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

KEY="${AISSTREAM_API_KEY:-}"
if [[ -z "$KEY" ]]; then
  echo "Set AISSTREAM_API_KEY in .env or the environment." >&2
  exit 1
fi

PREFIX="$(ssm_env_prefix "$ENV")"
ssm_put_secure "${PREFIX}/AISSTREAM_API_KEY" "$KEY"
echo "Updated ${PREFIX}/AISSTREAM_API_KEY."

if [[ "$NO_REDEPLOY" == "true" ]]; then
  exit 0
fi

force_ecs_redeploy "$ENV"

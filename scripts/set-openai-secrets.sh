#!/usr/bin/env bash
# Set OPENAI_API_KEY in SSM and redeploy ECS.
set -euo pipefail

ENV="${1:?usage: set-openai-secrets.sh staging|production [--no-redeploy]}"
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

KEY="${OPENAI_API_KEY:-}"
if [[ -z "$KEY" ]]; then
  echo "Set OPENAI_API_KEY in .env or the environment." >&2
  exit 1
fi

PREFIX="$(ssm_env_prefix "$ENV")"
ACCOUNT_PARAM="$(ssm_account_prefix)/openai-api-key"
ssm_put_secure "${PREFIX}/OPENAI_API_KEY" "$KEY"
ssm_put_secure "$ACCOUNT_PARAM" "$KEY"
echo "Updated ${PREFIX}/OPENAI_API_KEY and ${ACCOUNT_PARAM}."

if [[ "$NO_REDEPLOY" == "true" ]]; then
  exit 0
fi

force_ecs_redeploy "$ENV"

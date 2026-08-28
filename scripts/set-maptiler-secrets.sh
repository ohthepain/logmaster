#!/usr/bin/env bash
# Merge MAPTILER_API_KEY into the ECS app secret and redeploy.
set -euo pipefail

ENV="${1:?usage: set-maptiler-secrets.sh staging|production [--no-redeploy]}"
NO_REDEPLOY=false
if [[ "${2:-}" == "--no-redeploy" ]]; then
  NO_REDEPLOY=true
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-eu-central-1}"
PROJECT="${LOGMASTER_PROJECT_NAME:-logmaster}"
SECRET_ID="${PROJECT}-${ENV}-app"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

KEY="${MAPTILER_API_KEY:-${VITE_MAPTILER_API_KEY:-${VITE_MAPTILER_KEY:-}}}"
if [[ -z "$KEY" ]]; then
  echo "Set MAPTILER_API_KEY or VITE_MAPTILER_API_KEY in .env or the environment." >&2
  exit 1
fi

export ENV REGION PROJECT SECRET_ID MAPTILER_API_KEY="$KEY" NO_REDEPLOY

python3 <<'PY'
import json
import os
import subprocess
import sys

secret_id = os.environ["SECRET_ID"]
region = os.environ["REGION"]
maptiler_key = os.environ["MAPTILER_API_KEY"]

current = subprocess.run(
    [
        "aws",
        "secretsmanager",
        "get-secret-value",
        "--secret-id",
        secret_id,
        "--region",
        region,
        "--query",
        "SecretString",
        "--output",
        "text",
    ],
    check=True,
    capture_output=True,
    text=True,
)
data = json.loads(current.stdout)
data["MAPTILER_API_KEY"] = maptiler_key

subprocess.run(
    [
        "aws",
        "secretsmanager",
        "put-secret-value",
        "--secret-id",
        secret_id,
        "--region",
        region,
        "--secret-string",
        json.dumps(data),
    ],
    check=True,
)

print(f"Updated {secret_id} with MAPTILER_API_KEY.")

if os.environ.get("NO_REDEPLOY") == "true":
    sys.exit(0)

env = os.environ["ENV"]
project = os.environ["PROJECT"]
cluster = f"{project}-{env}-cluster"
service = f"{project}-{env}-service"

subprocess.run(
    [
        "aws",
        "ecs",
        "update-service",
        "--cluster",
        cluster,
        "--service",
        service,
        "--force-new-deployment",
        "--region",
        region,
        "--no-cli-pager",
    ],
    check=True,
)
print(f"Forced new ECS deployment on {service}.")
PY

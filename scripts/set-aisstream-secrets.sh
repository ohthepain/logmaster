#!/usr/bin/env bash
# Merge AISSTREAM_API_KEY into the ECS app secret and redeploy.
set -euo pipefail

ENV="${1:?usage: set-aisstream-secrets.sh staging|production [--no-redeploy]}"
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

KEY="${AISSTREAM_API_KEY:-}"
if [[ -z "$KEY" ]]; then
  echo "Set AISSTREAM_API_KEY in .env or the environment." >&2
  exit 1
fi

export ENV REGION PROJECT SECRET_ID AISSTREAM_API_KEY="$KEY" NO_REDEPLOY

python3 <<'PY'
import json
import os
import subprocess
import sys

secret_id = os.environ["SECRET_ID"]
region = os.environ["REGION"]
aisstream_key = os.environ["AISSTREAM_API_KEY"]

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
data["AISSTREAM_API_KEY"] = aisstream_key

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

print(f"Updated {secret_id} with AISSTREAM_API_KEY.")

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

#!/usr/bin/env bash
# Merge APNS credentials into the ECS app secret and redeploy.
set -euo pipefail

ENV="${1:?usage: set-apns-secrets.sh staging|production [--no-redeploy]}"
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

export ENV REGION PROJECT SECRET_ID NO_REDEPLOY
export APNS_KEY="$KEY"
export APNS_KEY_ID APNS_TEAM_ID APNS_BUNDLE_ID

python3 <<'PY'
import json
import os
import subprocess
import sys

secret_id = os.environ["SECRET_ID"]
region = os.environ["REGION"]

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
data["APNS_KEY"] = os.environ["APNS_KEY"]
data["APNS_KEY_ID"] = os.environ["APNS_KEY_ID"]
data["APNS_TEAM_ID"] = os.environ["APNS_TEAM_ID"]
data["APNS_BUNDLE_ID"] = os.environ["APNS_BUNDLE_ID"]

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

print(f"Updated {secret_id} with APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID.")

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

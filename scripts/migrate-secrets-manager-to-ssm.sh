#!/usr/bin/env bash
# Copy logmaster Secrets Manager secrets into SSM Parameter Store (one-time cutover).
#
# Usage:
#   ./scripts/migrate-secrets-manager-to-ssm.sh staging|production
#
# Optional env (account-level copy from legacy Secrets Manager ARNs):
#   MAPTILER_SM_ARN, AISSTREAM_SM_ARN, GOOGLE_CLIENT_ID_SM_ARN, GOOGLE_CLIENT_SECRET_SM_ARN, APNS_KEY_SM_ARN
#
# Defaults for MapTiler / AISStream match the former terraform.tfvars ARNs.
set -euo pipefail

ENV="${1:?usage: migrate-secrets-manager-to-ssm.sh staging|production}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-eu-central-1}"
PROJECT="${LOGMASTER_PROJECT_NAME:-logmaster}"
PREFIX="/${PROJECT}/${ENV}"
ACCOUNT_PREFIX="/${PROJECT}/account"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib/ssm-parameters.sh"

MAPTILER_SM_ARN="${MAPTILER_SM_ARN:-arn:aws:secretsmanager:eu-central-1:320205321328:secret:maptiler-api-key-UwRgH7}"
AISSTREAM_SM_ARN="${AISSTREAM_SM_ARN:-arn:aws:secretsmanager:eu-central-1:320205321328:secret:aisstream-api-key-OIoEmc}"

sm_get_string() {
  local secret_id="$1"
  aws secretsmanager get-secret-value \
    --secret-id "$secret_id" \
    --region "$REGION" \
    --query SecretString \
    --output text
}

copy_sm_plain_to_param() {
  local secret_id="$1"
  local param_name="$2"
  if [[ -z "$secret_id" ]]; then
    return 0
  fi
  if ! value="$(sm_get_string "$secret_id" 2>/dev/null)"; then
    echo "Skip account copy (secret not found): $secret_id" >&2
    return 0
  fi
  ssm_put_secure "$param_name" "$value"
  echo "Account parameter ${param_name} ← Secrets Manager"
}

copy_sm_json_keys_to_env_params() {
  local secret_id="$1"
  local json
  json="$(sm_get_string "$secret_id")"
  python3 - "$PREFIX" "$json" <<'PY'
import json
import os
import subprocess
import sys

prefix = sys.argv[1]
data = json.loads(sys.argv[2])
region = os.environ.get("AWS_REGION", "eu-central-1")

for key, value in data.items():
    if value is None:
        continue
    text = str(value)
    if text == "":
        continue
    name = f"{prefix}/{key}"
    subprocess.run(
        [
            "aws",
            "ssm",
            "put-parameter",
            "--name",
            name,
            "--type",
            "SecureString",
            "--value",
            text,
            "--overwrite",
            "--region",
            region,
            "--no-cli-pager",
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    print(f"Parameter {name}")
PY
}

echo "=== Account-level parameters (${ACCOUNT_PREFIX}) ==="
copy_sm_plain_to_param "$MAPTILER_SM_ARN" "${ACCOUNT_PREFIX}/maptiler-api-key"
copy_sm_plain_to_param "$AISSTREAM_SM_ARN" "${ACCOUNT_PREFIX}/aisstream-api-key"
copy_sm_plain_to_param "${GOOGLE_CLIENT_ID_SM_ARN:-}" "${ACCOUNT_PREFIX}/google-client-id"
copy_sm_plain_to_param "${GOOGLE_CLIENT_SECRET_SM_ARN:-}" "${ACCOUNT_PREFIX}/google-client-secret"
copy_sm_plain_to_param "${APNS_KEY_SM_ARN:-}" "${ACCOUNT_PREFIX}/apns-key"

echo "=== Environment ${ENV} (${PREFIX}) ==="
DB_SECRET="${PROJECT}-${ENV}-database"
APP_SECRET="${PROJECT}-${ENV}-app"

if aws secretsmanager describe-secret --secret-id "$DB_SECRET" --region "$REGION" >/dev/null 2>&1; then
  copy_sm_json_keys_to_env_params "$DB_SECRET"
else
  echo "No Secrets Manager secret ${DB_SECRET} — skip database keys." >&2
fi

if aws secretsmanager describe-secret --secret-id "$APP_SECRET" --region "$REGION" >/dev/null 2>&1; then
  copy_sm_json_keys_to_env_params "$APP_SECRET"
else
  echo "No Secrets Manager secret ${APP_SECRET} — skip app keys." >&2
fi

echo "Done. Verify with: aws ssm get-parameters-by-path --path ${PREFIX} --with-decryption --region ${REGION}"

#!/usr/bin/env bash
# Import pre-existing /logmaster/{env}/* SSM parameters into Terraform state (after migrate-secrets-manager-to-ssm.sh).
set -euo pipefail

ENV="${1:?usage: import-env-ssm-parameters.sh staging|production}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${LOGMASTER_PROJECT_NAME:-logmaster}"
PREFIX="/${PROJECT}/${ENV}"

cd "$ROOT/terraform"
terraform workspace select "$ENV"

import_param() {
  local resource="$1"
  local name="$2"
  terraform import -var-file="environments/${ENV}/terraform.tfvars" "$resource" "$name"
}

import_param aws_ssm_parameter.database_url "${PREFIX}/DATABASE_URL"
import_param aws_ssm_parameter.better_auth_secret "${PREFIX}/BETTER_AUTH_SECRET"
import_param aws_ssm_parameter.google_client_id "${PREFIX}/GOOGLE_CLIENT_ID"
import_param aws_ssm_parameter.google_client_secret "${PREFIX}/GOOGLE_CLIENT_SECRET"
import_param aws_ssm_parameter.ses_from_email "${PREFIX}/AWS_SES_FROM_EMAIL"

if aws ssm get-parameter --name "${PREFIX}/MAPTILER_API_KEY" --region "${AWS_REGION:-eu-central-1}" >/dev/null 2>&1; then
  import_param aws_ssm_parameter.maptiler_api_key "${PREFIX}/MAPTILER_API_KEY"
fi
if aws ssm get-parameter --name "${PREFIX}/AISSTREAM_API_KEY" --region "${AWS_REGION:-eu-central-1}" >/dev/null 2>&1; then
  import_param aws_ssm_parameter.aisstream_api_key "${PREFIX}/AISSTREAM_API_KEY"
fi
if aws ssm get-parameter --name "${PREFIX}/APNS_KEY" --region "${AWS_REGION:-eu-central-1}" >/dev/null 2>&1; then
  import_param aws_ssm_parameter.apns_key "${PREFIX}/APNS_KEY"
  import_param aws_ssm_parameter.apns_key_id "${PREFIX}/APNS_KEY_ID"
  import_param aws_ssm_parameter.apns_team_id "${PREFIX}/APNS_TEAM_ID"
  import_param aws_ssm_parameter.apns_bundle_id "${PREFIX}/APNS_BUNDLE_ID"
fi

echo "Import complete for ${PREFIX}/*"

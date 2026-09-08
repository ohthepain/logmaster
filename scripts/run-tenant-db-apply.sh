#!/usr/bin/env bash
# Apply tenant database resources (requires VPC access to shared RDS).
#
# Usage:
#   ./scripts/run-tenant-db-apply.sh staging
#
# If local apply times out, provision from inside the VPC instead:
#   SHARED_AWS_ROOT=/path/to/shared-aws ./scripts/provision-tenant-db.sh logmaster staging "$(terraform output -raw database_url | …)"
set -euo pipefail

ENV="${1:-}"
if [[ -z "$ENV" ]]; then
  echo "Usage: $0 <environment>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/terraform"
terraform workspace select "$ENV"

terraform apply \
  -var-file="environments/${ENV}/terraform.tfvars" \
  -var="apply_tenant_database_resources=true" \
  -target=random_password.db_tenant \
  -target='postgresql_role.tenant[0]' \
  -target='postgresql_database.tenant[0]' \
  -target='postgresql_grant.tenant_database[0]' \
  -target=aws_secretsmanager_secret_version.database \
  "${@:2}"

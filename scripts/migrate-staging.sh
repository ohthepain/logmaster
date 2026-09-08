#!/usr/bin/env bash
# Migrate logmaster staging from legacy per-app RDS/ALB to shared-aws.
#
# Prerequisites:
#   - shared-aws bootstrap, network, and shared stacks applied
#   - logmaster staging terraform applied against shared infra
#   - AWS CLI configured for eu-central-1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for candidate in \
  "${SHARED_AWS_ROOT:-}" \
  "$ROOT/../shared-aws" \
  "$ROOT/../../shared-aws"; do
  if [[ -n "$candidate" && -d "$candidate/terraform/shared" ]]; then
    SHARED_ROOT="$(cd "$candidate" && pwd)"
    break
  fi
done
ENV=staging
TENANT="logmaster_${ENV}"

if [[ -z "$SHARED_ROOT" ]]; then
  echo "Set SHARED_AWS_ROOT to the shared-aws repo path." >&2
  exit 1
fi

cd "$ROOT/terraform"
terraform workspace select "$ENV"

LEGACY_DB_ID="logmaster-${ENV}-db"
LEGACY_DB_HOST="$(aws rds describe-db-instances \
  --db-instance-identifier "$LEGACY_DB_ID" \
  --region eu-central-1 \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text 2>/dev/null || true)"

if [[ -z "$LEGACY_DB_HOST" || "$LEGACY_DB_HOST" == "None" ]]; then
  echo "Legacy RDS ${LEGACY_DB_ID} not found. Set SOURCE_* env vars manually if already deleted."
  [[ -n "${SOURCE_HOST:-}" ]] || exit 1
  LEGACY_DB_HOST="$SOURCE_HOST"
fi

TARGET_PASSWORD="$(terraform output -raw database_url 2>/dev/null | sed -n 's#.*://[^:]*:\([^@]*\)@.*#\1#p')"
if [[ -z "$TARGET_PASSWORD" ]]; then
  echo "Run terraform apply for staging first to generate tenant database credentials." >&2
  exit 1
fi

SOURCE_PASSWORD="${SOURCE_PASSWORD:-$(cd "$ROOT/terraform" && terraform workspace select "$ENV" >/dev/null 2>&1; terraform output -raw database_url 2>/dev/null | sed -n 's#.*://[^:]*:\([^@]*\)@.*#\1#p' || true)}"

if [[ -z "$SOURCE_PASSWORD" ]]; then
  echo "Set SOURCE_PASSWORD to the legacy staging database password." >&2
  exit 1
fi

echo "==> Migrating ${TENANT} from ${LEGACY_DB_HOST}"
"$SHARED_ROOT/scripts/migrate-tenant-db.sh" \
  --tenant "$TENANT" \
  --source-host "$LEGACY_DB_HOST" \
  --source-user logmaster \
  --source-password "$SOURCE_PASSWORD" \
  --source-db logmaster \
  --target-password "$TARGET_PASSWORD"

echo "==> DNS cutover"
"$SHARED_ROOT/scripts/cutover-dns-checklist.sh" staging.logmaster.live

echo "After soak test, run: ./scripts/decommission-legacy.sh staging"

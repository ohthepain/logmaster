#!/usr/bin/env bash
# Remove legacy per-app RDS and ALB after successful shared-aws migration.
#
# Usage: ./scripts/decommission-legacy.sh staging
set -euo pipefail

ENV="${1:-}"
if [[ -z "$ENV" ]]; then
  echo "Usage: $0 <staging|production>" >&2
  exit 1
fi

REGION="${AWS_REGION:-eu-central-1}"
PROJECT="${LOGMASTER_PROJECT_NAME:-logmaster}"
LEGACY_DB_ID="${PROJECT}-${ENV}-db"
LEGACY_ALB_NAME="${PROJECT}-${ENV}-alb"

echo "This will DELETE legacy resources for ${PROJECT} ${ENV}:"
echo "  - RDS: ${LEGACY_DB_ID}"
echo "  - ALB: ${LEGACY_ALB_NAME}"
read -r -p "Continue? [y/N] " CONFIRM
[[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]] || exit 0

echo "Deleting legacy ALB ${LEGACY_ALB_NAME}..."
ALB_ARN="$(aws elbv2 describe-load-balancers \
  --names "$LEGACY_ALB_NAME" \
  --region "$REGION" \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text 2>/dev/null || true)"
if [[ -n "$ALB_ARN" && "$ALB_ARN" != "None" ]]; then
  aws elbv2 delete-load-balancer --load-balancer-arn "$ALB_ARN" --region "$REGION"
fi

echo "Deleting legacy RDS ${LEGACY_DB_ID}..."
if aws rds describe-db-instances --db-instance-identifier "$LEGACY_DB_ID" --region "$REGION" >/dev/null 2>&1; then
  aws rds delete-db-instance \
    --db-instance-identifier "$LEGACY_DB_ID" \
    --skip-final-snapshot \
    --region "$REGION"
fi

echo "Remove orphaned resources from terraform state if needed:"
echo "  cd terraform && terraform workspace select ${ENV}"
echo "  terraform state list | grep -E 'aws_db_instance|aws_lb\\.'"

echo "After all tenants migrate, destroy logmaster terraform/network stack."

#!/usr/bin/env bash
# Scale staging ECS to 0. Shared RDS stays running (shared by all tenants).
set -euo pipefail

REGION="${AWS_REGION:-eu-central-1}"
PROJECT="${LOGMASTER_PROJECT_NAME:-logmaster}"
ENV=staging

CLUSTER="${PROJECT}-${ENV}-cluster"
SERVICE="${PROJECT}-${ENV}-service"

echo "Scaling ECS service ${SERVICE} to desired count 0..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --desired-count 0 \
  --region "$REGION"

echo "Done. Shared RDS is not stopped (other tenants may depend on it)."

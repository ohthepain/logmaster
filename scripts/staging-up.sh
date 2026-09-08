#!/usr/bin/env bash
# Scale staging ECS back up and recycle tasks.
set -euo pipefail

REGION="${AWS_REGION:-eu-central-1}"
PROJECT="${LOGMASTER_PROJECT_NAME:-logmaster}"
ENV=staging
DESIRED="${ECS_DESIRED_COUNT:-1}"

CLUSTER="${PROJECT}-${ENV}-cluster"
SERVICE="${PROJECT}-${ENV}-service"

echo "Scaling ECS service ${SERVICE} to desired count ${DESIRED}..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --desired-count "$DESIRED" \
  --force-new-deployment \
  --region "$REGION" \
  --output text --query 'service.{desired:desiredCount,running:runningCount,status:status}'

echo "Done."

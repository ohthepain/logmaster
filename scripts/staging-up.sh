#!/usr/bin/env bash
# Start staging RDS, wait until available, then scale ECS back up and recycle tasks.
set -euo pipefail

REGION="${AWS_REGION:-eu-central-1}"
PROJECT="${LOGMASTER_PROJECT_NAME:-logmaster}"
ENV=staging
DESIRED="${ECS_DESIRED_COUNT:-1}"

CLUSTER="${PROJECT}-${ENV}-cluster"
SERVICE="${PROJECT}-${ENV}-service"
DB_ID="${PROJECT}-${ENV}-db"

rds_status() {
	aws rds describe-db-instances \
		--db-instance-identifier "$DB_ID" \
		--region "$REGION" \
		--query 'DBInstances[0].DBInstanceStatus' \
		--output text
}

wait_for_rds_available() {
	echo "Waiting for RDS ${DB_ID} to become available..."
	aws rds wait db-instance-available \
		--db-instance-identifier "$DB_ID" \
		--region "$REGION"
}

STATUS="$(rds_status)"
echo "RDS instance ${DB_ID} status: ${STATUS}"

case "$STATUS" in
available)
	echo "RDS is already available."
	;;
stopped)
	echo "Starting RDS instance ${DB_ID}..."
	aws rds start-db-instance \
		--db-instance-identifier "$DB_ID" \
		--region "$REGION"
	wait_for_rds_available
	;;
starting|rebooting|backing-up|modifying|upgrading|configuring-enhanced-monitoring)
	echo "RDS is ${STATUS}; waiting until available..."
	wait_for_rds_available
	;;
stopping)
	echo "RDS is stopping; waiting until stopped, then starting..."
	aws rds wait db-instance-stopped \
		--db-instance-identifier "$DB_ID" \
		--region "$REGION"
	aws rds start-db-instance \
		--db-instance-identifier "$DB_ID" \
		--region "$REGION"
	wait_for_rds_available
	;;
*)
	echo "Cannot bring up staging RDS from status '${STATUS}'." >&2
	echo "Check the instance in the RDS console and retry when it is stopped or available." >&2
	exit 1
	;;
esac

echo "Scaling ECS service ${SERVICE} to desired count ${DESIRED}..."
aws ecs update-service \
	--cluster "$CLUSTER" \
	--service "$SERVICE" \
	--desired-count "$DESIRED" \
	--force-new-deployment \
	--region "$REGION" \
	--output text --query 'service.{desired:desiredCount,running:runningCount,status:status}'

echo "Done."

#!/usr/bin/env bash
# Run platform-admin CLI inside the VPC (one-off Fargate task). Use when direct
# DATABASE_URL from your laptop times out — RDS is not publicly reachable.
#
# Usage:
#   ./scripts/platform-admin-via-ecs.sh production grant cremoni@gmail.com
#   ./scripts/platform-admin-via-ecs.sh production list
#
# Requires: AWS CLI, jq, and an image already deployed that includes scripts/platform-admin.ts
# and the platformAdminAt migration.
set -euo pipefail

ENV="${1:?usage: platform-admin-via-ecs.sh staging|production <list|grant|revoke> [email]}"
SUBCMD="${2:?usage: platform-admin-via-ecs.sh staging|production <list|grant|revoke> [email]}"
EMAIL="${3:-}"

if [[ "$SUBCMD" == "grant" || "$SUBCMD" == "revoke" ]] && [[ -z "$EMAIL" ]]; then
  echo "Email required for $SUBCMD." >&2
  exit 1
fi

REGION="${AWS_REGION:-eu-central-1}"
PROJECT="${LOGMASTER_PROJECT_NAME:-logmaster}"
CLUSTER="${PROJECT}-${ENV}-cluster"
SERVICE="${PROJECT}-${ENV}-service"
LOG_GROUP="/ecs/${PROJECT}-${ENV}"

SERVICE_JSON="$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "$REGION" \
  --no-cli-pager)"

TASK_DEF="$(echo "$SERVICE_JSON" | jq -r '.services[0].taskDefinition')"
if [[ -z "$TASK_DEF" || "$TASK_DEF" == "null" ]]; then
  echo "ECS service not found: ${CLUSTER}/${SERVICE}" >&2
  exit 1
fi

NET="$(echo "$SERVICE_JSON" | jq -r '.services[0].networkConfiguration.awsvpcConfiguration')"
SUBNETS="$(echo "$NET" | jq -r '.subnets | join(",")')"
SGS="$(echo "$NET" | jq -r '.securityGroups | join(",")')"
PUBLIC_IP="$(echo "$NET" | jq -r '.assignPublicIp')"

CMD_JSON="$(jq -n \
  --arg subcmd "$SUBCMD" \
  --arg email "$EMAIL" \
  '["node", "--import", "tsx", "scripts/platform-admin.ts", $subcmd]
   + (if $email != "" then [$email] else [] end)')"

OVERRIDES="$(jq -n --argjson cmd "$CMD_JSON" \
  '{containerOverrides: [{name: "app", command: $cmd}]}')"

echo "Starting one-off task on ${CLUSTER} (${SUBCMD}${EMAIL:+ $EMAIL})…"

RUN_JSON="$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SGS}],assignPublicIp=${PUBLIC_IP}}" \
  --overrides "$OVERRIDES" \
  --region "$REGION" \
  --no-cli-pager)"

TASK_ARN="$(echo "$RUN_JSON" | jq -r '.tasks[0].taskArn')"
if [[ -z "$TASK_ARN" || "$TASK_ARN" == "null" ]]; then
  echo "run-task failed:" >&2
  echo "$RUN_JSON" >&2
  exit 1
fi

TASK_ID="${TASK_ARN##*/}"
echo "Task ${TASK_ID} — waiting for completion…"

aws ecs wait tasks-stopped \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --region "$REGION" \
  --no-cli-pager

STOPPED="$(aws ecs describe-tasks \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --region "$REGION" \
  --no-cli-pager)"

EXIT_CODE="$(echo "$STOPPED" | jq -r '.tasks[0].containers[] | select(.name=="app") | .exitCode')"
STOP_REASON="$(echo "$STOPPED" | jq -r '.tasks[0].stoppedReason // empty')"

STREAM="$(aws logs describe-log-streams \
  --log-group-name "$LOG_GROUP" \
  --log-stream-name-prefix "app/app/${TASK_ID}" \
  --region "$REGION" \
  --no-cli-pager \
  | jq -r '.logStreams[0].logStreamName // empty')"

if [[ -n "$STREAM" ]]; then
  echo "--- task logs (${STREAM}) ---"
  aws logs get-log-events \
    --log-group-name "$LOG_GROUP" \
    --log-stream-name "$STREAM" \
    --region "$REGION" \
    --no-cli-pager \
    | jq -r '.events[].message'
  echo "--- end logs ---"
else
  echo "No CloudWatch log stream found under ${LOG_GROUP} for task ${TASK_ID}." >&2
fi

if [[ -n "$STOP_REASON" ]]; then
  echo "Stopped: ${STOP_REASON}" >&2
fi

if [[ "$EXIT_CODE" != "0" ]]; then
  echo "Task failed (exit ${EXIT_CODE:-unknown})." >&2
  exit 1
fi

echo "Done."

#!/usr/bin/env bash
# Run platform-admin CLI inside the VPC (one-off Fargate task). Use when direct
# DATABASE_URL from your laptop times out — RDS is not publicly reachable.
#
# Usage:
#   ./scripts/platform-admin-via-ecs.sh production grant cremoni@gmail.com
#   ./scripts/platform-admin-via-ecs.sh production list
#
# Requires: AWS CLI, jq, and a deployed app image (uses src/server/db.ts already in the image).
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

# Older images omit scripts/platform-admin.ts. Drive the CLI from env + src/server/db.ts.
PLATFORM_ADMIN_JS="import { prisma } from './src/server/db.ts'
const cmd = process.env.PLATFORM_ADMIN_CMD
const email = (process.env.PLATFORM_ADMIN_EMAIL ?? '').trim().toLowerCase()
const fail = (message) => { console.error(message); process.exit(1) }
const main = async () => {
  if (cmd === 'list') {
    const rows = await prisma.user.findMany({
      where: { platformAdminAt: { not: null } },
      orderBy: { email: 'asc' },
      select: { email: true, platformAdminAt: true },
    })
    if (rows.length === 0) console.info('No platform admins in the database.')
    else for (const row of rows) console.info(\`\${row.email}\\t\${row.platformAdminAt?.toISOString() ?? ''}\`)
    return
  }
  if (cmd !== 'grant' && cmd !== 'revoke') fail(\`Unknown command: \${cmd}\`)
  if (!email) fail('Email required')
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, platformAdminAt: true },
  })
  if (!user) fail(\`No user with email \${email}. They must sign in once, then run grant again.\`)
  if (cmd === 'grant') {
    if (user.platformAdminAt) {
      console.info(\`Already platform admin: \${user.email}\`)
      return
    }
    await prisma.user.update({ where: { id: user.id }, data: { platformAdminAt: new Date() } })
    console.info(\`Granted platform admin: \${user.email}\`)
    return
  }
  if (!user.platformAdminAt) {
    console.info(\`Not a platform admin: \${user.email}\`)
    return
  }
  await prisma.user.update({ where: { id: user.id }, data: { platformAdminAt: null } })
  console.info(\`Revoked platform admin: \${user.email}\`)
}
await main().finally(() => prisma.\$disconnect())"

OVERRIDES="$(jq -n \
  --arg js "$PLATFORM_ADMIN_JS" \
  --arg subcmd "$SUBCMD" \
  --arg email "$EMAIL" \
  '{
    containerOverrides: [{
      name: "app",
      command: ["node", "--import", "tsx", "--input-type=module", "-e", $js],
      environment: [
        {name: "PLATFORM_ADMIN_CMD", value: $subcmd},
        {name: "PLATFORM_ADMIN_EMAIL", value: $email}
      ]
    }]
  }')"

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

# shellcheck shell=bash
# Shared helpers for logmaster SSM Parameter Store paths and ECS redeploy.

ssm_env_prefix() {
  local env="$1"
  local project="${LOGMASTER_PROJECT_NAME:-logmaster}"
  echo "/${project}/${env}"
}

ssm_put_secure() {
  local name="$1"
  local value="$2"
  local region="${AWS_REGION:-eu-central-1}"
  aws ssm put-parameter \
    --name "$name" \
    --type SecureString \
    --value "$value" \
    --overwrite \
    --region "$region" \
    --no-cli-pager >/dev/null
}

force_ecs_redeploy() {
  local env="$1"
  local region="${AWS_REGION:-eu-central-1}"
  local project="${LOGMASTER_PROJECT_NAME:-logmaster}"
  local cluster="${project}-${env}-cluster"
  local service="${project}-${env}-service"
  aws ecs update-service \
    --cluster "$cluster" \
    --service "$service" \
    --force-new-deployment \
    --region "$region" \
    --no-cli-pager >/dev/null
  echo "Forced new ECS deployment on ${service}."
}

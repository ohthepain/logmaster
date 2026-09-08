locals {
  name_prefix = "${var.project_name}-${var.environment}"
  is_prod     = var.environment == "production"

  # Must match the hostname users use in the browser (OAuth redirect_uri = this + /api/auth/callback/google).
  better_auth_url = local.is_prod ? "https://logmaster.live" : "https://staging.logmaster.live"
  apns_production = var.apns_production != null ? var.apns_production : local.is_prod

  tenant_database_name = "${var.project_name}_${var.environment}"
  app_hostname         = replace(local.better_auth_url, "https://", "")

  # Single source of truth for ECS Secrets Manager and `terraform output database_url`.
  database_url = "postgresql://${local.tenant_database_name}:${random_password.db_tenant.result}@${data.terraform_remote_state.shared.outputs.rds_endpoint}:5432/${local.tenant_database_name}?sslmode=require"
}

check "workspace_matches_environment" {
  assert {
    condition     = terraform.workspace == var.environment
    error_message = "Terraform workspace (${terraform.workspace}) must match var.environment (${var.environment}). Use: terraform workspace select ${var.environment}"
  }
}

check "google_auth_configured" {
  assert {
    condition = !var.google_auth_enabled || (
      var.google_client_id_secret_arn != "" && var.google_client_secret_secret_arn != ""
    )
    error_message = "google_auth_enabled is true but google_client_id_secret_arn and google_client_secret_secret_arn are unset. Add ARNs to environments/${var.environment}/terraform.tfvars, or run scripts/set-google-oauth-secrets.sh ${var.environment} after deploy."
  }
}

data "terraform_remote_state" "shared" {
  backend   = "s3"
  workspace = "default"

  config = {
    bucket = var.shared_state_bucket
    key    = var.shared_state_key
    region = var.aws_region
  }
}

data "aws_secretsmanager_secret_version" "shared_rds_master" {
  secret_id = data.terraform_remote_state.shared.outputs.rds_master_secret_arn
}

locals {
  shared_rds_master = jsondecode(data.aws_secretsmanager_secret_version.shared_rds_master.secret_string)
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

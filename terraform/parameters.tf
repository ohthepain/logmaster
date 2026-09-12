locals {
  ssm_env_prefix     = "/${var.project_name}/${var.environment}"
  ssm_account_prefix = "/${var.project_name}/account"

  legacy_app_json = var.bootstrap_from_legacy_secrets_manager ? jsondecode(data.aws_secretsmanager_secret_version.legacy_app[0].secret_string) : {}

  ssm_better_auth_secret_initial = coalesce(
    try(local.legacy_app_json["BETTER_AUTH_SECRET"], ""),
    random_password.better_auth_secret.result,
  )

  # SSM rejects zero-length values; a single space is stored for unset optional secrets (trimmed empty in app code).
  ssm_google_client_id_initial = (
    trimspace(try(local.legacy_app_json["GOOGLE_CLIENT_ID"], "")) != "" ?
    local.legacy_app_json["GOOGLE_CLIENT_ID"] :
    local.account_google_client_id_value != "" ? local.account_google_client_id_value : " "
  )

  ssm_google_client_secret_initial = (
    trimspace(try(local.legacy_app_json["GOOGLE_CLIENT_SECRET"], "")) != "" ?
    local.legacy_app_json["GOOGLE_CLIENT_SECRET"] :
    local.account_google_client_secret_value != "" ? local.account_google_client_secret_value : " "
  )

  ssm_ses_from_email_initial = (
    trimspace(try(local.legacy_app_json["AWS_SES_FROM_EMAIL"], "")) != "" ?
    local.legacy_app_json["AWS_SES_FROM_EMAIL"] :
    var.ses_from_email
  )

  ssm_maptiler_api_key_initial = (
    trimspace(try(local.legacy_app_json["MAPTILER_API_KEY"], "")) != "" ?
    local.legacy_app_json["MAPTILER_API_KEY"] :
    local.account_maptiler_api_key_value != "" ? local.account_maptiler_api_key_value : " "
  )

  ssm_aisstream_api_key_initial = (
    trimspace(try(local.legacy_app_json["AISSTREAM_API_KEY"], "")) != "" ?
    local.legacy_app_json["AISSTREAM_API_KEY"] :
    local.account_aisstream_api_key_value != "" ? local.account_aisstream_api_key_value : " "
  )

  ssm_openai_api_key_initial = (
    trimspace(try(local.legacy_app_json["OPENAI_API_KEY"], "")) != "" ?
    local.legacy_app_json["OPENAI_API_KEY"] :
    local.account_openai_api_key_value != "" ? local.account_openai_api_key_value : " "
  )

  ssm_apns_key_initial = (
    trimspace(try(local.legacy_app_json["APNS_KEY"], "")) != "" ?
    local.legacy_app_json["APNS_KEY"] :
    local.account_apns_key_value != "" ? local.account_apns_key_value : " "
  )

  ssm_apns_key_id_initial = (
    trimspace(try(local.legacy_app_json["APNS_KEY_ID"], "")) != "" ?
    local.legacy_app_json["APNS_KEY_ID"] :
    var.apns_key_id != "" ? var.apns_key_id : " "
  )

  ssm_apns_team_id_initial = (
    trimspace(try(local.legacy_app_json["APNS_TEAM_ID"], "")) != "" ?
    local.legacy_app_json["APNS_TEAM_ID"] :
    var.apns_team_id != "" ? var.apns_team_id : " "
  )

  ssm_apns_bundle_id_initial = (
    trimspace(try(local.legacy_app_json["APNS_BUNDLE_ID"], "")) != "" ?
    local.legacy_app_json["APNS_BUNDLE_ID"] :
    var.apns_bundle_id
  )
}

data "aws_secretsmanager_secret_version" "legacy_app" {
  count     = var.bootstrap_from_legacy_secrets_manager ? 1 : 0
  secret_id = "${local.name_prefix}-app"
}

data "aws_ssm_parameter" "account_google_client_id" {
  count = !var.bootstrap_from_legacy_secrets_manager && var.google_client_id_parameter_name != "" ? 1 : 0
  name  = var.google_client_id_parameter_name
}

data "aws_ssm_parameter" "account_google_client_secret" {
  count = !var.bootstrap_from_legacy_secrets_manager && var.google_client_secret_parameter_name != "" ? 1 : 0
  name  = var.google_client_secret_parameter_name
}

data "aws_ssm_parameter" "account_maptiler_api_key" {
  count = var.maptiler_api_key_parameter_name != "" ? 1 : 0
  name  = var.maptiler_api_key_parameter_name
}

data "aws_ssm_parameter" "account_aisstream_api_key" {
  count = var.aisstream_api_key_parameter_name != "" ? 1 : 0
  name  = var.aisstream_api_key_parameter_name
}

data "aws_ssm_parameter" "account_openai_api_key" {
  count = var.openai_api_key_parameter_name != "" ? 1 : 0
  name  = var.openai_api_key_parameter_name
}

data "aws_ssm_parameter" "account_apns_key" {
  count = !var.bootstrap_from_legacy_secrets_manager && var.apns_key_parameter_name != "" ? 1 : 0
  name  = var.apns_key_parameter_name
}

locals {
  account_google_client_id_value     = try(data.aws_ssm_parameter.account_google_client_id[0].value, "")
  account_google_client_secret_value = try(data.aws_ssm_parameter.account_google_client_secret[0].value, "")
  account_maptiler_api_key_value     = try(data.aws_ssm_parameter.account_maptiler_api_key[0].value, "")
  account_aisstream_api_key_value    = try(data.aws_ssm_parameter.account_aisstream_api_key[0].value, "")
  account_openai_api_key_value       = try(data.aws_ssm_parameter.account_openai_api_key[0].value, "")
  account_apns_key_value             = try(data.aws_ssm_parameter.account_apns_key[0].value, "")
}

resource "random_password" "better_auth_secret" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "database_url" {
  name  = "${local.ssm_env_prefix}/DATABASE_URL"
  type  = "SecureString"
  value = local.database_url

  tags = {
    Name = "${local.name_prefix}-database-url"
  }
}

resource "aws_ssm_parameter" "better_auth_secret" {
  name  = "${local.ssm_env_prefix}/BETTER_AUTH_SECRET"
  type  = "SecureString"
  value = local.ssm_better_auth_secret_initial

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.name_prefix}-better-auth-secret"
  }
}

resource "aws_ssm_parameter" "google_client_id" {
  name  = "${local.ssm_env_prefix}/GOOGLE_CLIENT_ID"
  type  = "SecureString"
  value = local.ssm_google_client_id_initial

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.name_prefix}-google-client-id"
  }
}

resource "aws_ssm_parameter" "google_client_secret" {
  name  = "${local.ssm_env_prefix}/GOOGLE_CLIENT_SECRET"
  type  = "SecureString"
  value = local.ssm_google_client_secret_initial

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.name_prefix}-google-client-secret"
  }
}

resource "aws_ssm_parameter" "ses_from_email" {
  name  = "${local.ssm_env_prefix}/AWS_SES_FROM_EMAIL"
  type  = "SecureString"
  value = local.ssm_ses_from_email_initial

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.name_prefix}-ses-from-email"
  }
}

resource "aws_ssm_parameter" "maptiler_api_key" {
  name  = "${local.ssm_env_prefix}/MAPTILER_API_KEY"
  type  = "SecureString"
  value = local.ssm_maptiler_api_key_initial

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.name_prefix}-maptiler-api-key"
  }
}

resource "aws_ssm_parameter" "aisstream_api_key" {
  name  = "${local.ssm_env_prefix}/AISSTREAM_API_KEY"
  type  = "SecureString"
  value = local.ssm_aisstream_api_key_initial

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.name_prefix}-aisstream-api-key"
  }
}

resource "aws_ssm_parameter" "openai_api_key" {
  name  = "${local.ssm_env_prefix}/OPENAI_API_KEY"
  type  = "SecureString"
  value = local.ssm_openai_api_key_initial

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.name_prefix}-openai-api-key"
  }
}

resource "aws_ssm_parameter" "apns_key" {
  name  = "${local.ssm_env_prefix}/APNS_KEY"
  type  = "SecureString"
  value = local.ssm_apns_key_initial

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.name_prefix}-apns-key"
  }
}

resource "aws_ssm_parameter" "apns_key_id" {
  name  = "${local.ssm_env_prefix}/APNS_KEY_ID"
  type  = "SecureString"
  value = local.ssm_apns_key_id_initial

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.name_prefix}-apns-key-id"
  }
}

resource "aws_ssm_parameter" "apns_team_id" {
  name  = "${local.ssm_env_prefix}/APNS_TEAM_ID"
  type  = "SecureString"
  value = local.ssm_apns_team_id_initial

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.name_prefix}-apns-team-id"
  }
}

resource "aws_ssm_parameter" "apns_bundle_id" {
  name  = "${local.ssm_env_prefix}/APNS_BUNDLE_ID"
  type  = "SecureString"
  value = local.ssm_apns_bundle_id_initial

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${local.name_prefix}-apns-bundle-id"
  }
}

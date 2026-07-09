resource "aws_secretsmanager_secret" "database" {
  name                    = "${local.name_prefix}-database"
  recovery_window_in_days = local.is_prod ? 30 : 0

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    DATABASE_URL = local.database_url
  })
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name_prefix}-app"
  recovery_window_in_days = local.is_prod ? 30 : 0

  lifecycle {
    prevent_destroy = true
  }
}

resource "random_password" "better_auth_secret" {
  length  = 64
  special = false
}

data "aws_secretsmanager_secret_version" "google_client_id" {
  count     = var.google_client_id_secret_arn != "" ? 1 : 0
  secret_id = var.google_client_id_secret_arn
}

data "aws_secretsmanager_secret_version" "google_client_secret" {
  count     = var.google_client_secret_secret_arn != "" ? 1 : 0
  secret_id = var.google_client_secret_secret_arn
}

data "aws_secretsmanager_secret_version" "maptiler_api_key" {
  count     = var.maptiler_api_key_secret_arn != "" ? 1 : 0
  secret_id = var.maptiler_api_key_secret_arn
}

locals {
  google_client_id_value     = try(data.aws_secretsmanager_secret_version.google_client_id[0].secret_string, "")
  google_client_secret_value = try(data.aws_secretsmanager_secret_version.google_client_secret[0].secret_string, "")
  maptiler_api_key_value     = try(data.aws_secretsmanager_secret_version.maptiler_api_key[0].secret_string, "")
}

resource "aws_secretsmanager_secret_version" "app_initial" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    BETTER_AUTH_SECRET = random_password.better_auth_secret.result
    GOOGLE_CLIENT_ID     = var.google_auth_enabled ? local.google_client_id_value : ""
    GOOGLE_CLIENT_SECRET = var.google_auth_enabled ? local.google_client_secret_value : ""
    AWS_SES_FROM_EMAIL     = var.ses_from_email
    MAPTILER_API_KEY       = local.maptiler_api_key_value
  })
}

variable "project_name" {
  type    = string
  default = "logmaster"
}

variable "environment" {
  type        = string
  description = "Must match the selected Terraform workspace (staging | production)."
}

variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "shared_state_bucket" {
  type        = string
  description = "S3 bucket holding the shared-aws stack state (shared-aws bootstrap output)."
}

variable "shared_state_key" {
  type    = string
  default = "shared/terraform.tfstate"
}

variable "alb_listener_rule_priority" {
  type        = number
  description = "Unique priority on the shared ALB HTTPS listener (logmaster staging=100, production=110)."
}

variable "ecs_desired_count" {
  type    = number
  default = 1
}

variable "ecs_cpu" {
  type    = number
  default = 512
}

variable "ecs_memory" {
  type    = number
  default = 1024
}

variable "app_port" {
  type    = number
  default = 3000
}

variable "health_check_path" {
  type    = string
  default = "/api/health"
}

variable "uploads_bucket_force_destroy" {
  type        = bool
  description = "Allow Terraform to delete uploads bucket even if non-empty (use false in production)."
  default     = false
}

variable "uploads_cors_allowed_origins" {
  type        = list(string)
  description = "CORS allowed origins for the uploads bucket."
  default     = ["*"]
}

variable "ses_from_email" {
  type        = string
  default     = "no-reply@logmaster.live"
  description = "From address stored in SSM Parameter Store (must be on a verified SES identity for this account/region)."
}

variable "ses_configuration_set" {
  type        = string
  default     = ""
  description = "Configuration set name passed to ECS as SES_CONFIGURATION_SET. Set ses_create_configuration_set to create it in Terraform."
}

variable "ses_create_configuration_set" {
  type        = bool
  default     = false
  description = "When true and ses_configuration_set is set, Terraform creates aws_sesv2_configuration_set."
}

variable "ses_domain_name" {
  type        = string
  default     = ""
  description = "e.g. logmaster.live — when ses_create_domain_identity is true, creates aws_sesv2_email_identity with Easy DKIM."
}

variable "ses_create_domain_identity" {
  type        = bool
  default     = false
  description = "When true and ses_domain_name is set, Terraform creates aws_sesv2_email_identity."
}

variable "auth_require_email_verification" {
  type    = bool
  default = false
}

variable "email_app_name" {
  type    = string
  default = "logmaster"
}

variable "google_auth_enabled" {
  type    = bool
  default = true
}

variable "bootstrap_from_legacy_secrets_manager" {
  type        = bool
  default     = true
  description = "Seed new SSM parameters from existing logmaster-{env}-database / logmaster-{env}-app Secrets Manager secrets on cutover. Set false after migration."
}

variable "google_client_id_parameter_name" {
  type        = string
  description = "Optional SSM name for shared Google OAuth client ID (bootstrap into per-env GOOGLE_CLIENT_ID on new environments)."
  default     = ""
}

variable "google_client_secret_parameter_name" {
  type        = string
  description = "Optional SSM name for shared Google OAuth client secret."
  default     = ""
}

variable "maptiler_api_key_parameter_name" {
  type        = string
  description = "SSM Parameter Store name for shared MapTiler API key."
  default     = "/logmaster/account/maptiler-api-key"
}

variable "aisstream_api_key_parameter_name" {
  type        = string
  description = "SSM Parameter Store name for shared AISStream.io API key."
  default     = "/logmaster/account/aisstream-api-key"
}

variable "openai_api_key_parameter_name" {
  type        = string
  description = "SSM Parameter Store name for shared OpenAI API key."
  default     = "/logmaster/account/openai-api-key"
}

variable "apns_key_parameter_name" {
  type        = string
  description = "SSM Parameter Store name for shared Apple APNS .p8 key (plain string file contents). Leave empty if not using a shared account parameter."
  default     = ""
}

variable "apns_key_id" {
  type        = string
  description = "Apple APNS key ID (10 characters)."
  default     = ""
}

variable "apns_team_id" {
  type        = string
  description = "Apple Developer Team ID."
  default     = ""
}

variable "apns_bundle_id" {
  type        = string
  description = "iOS app bundle ID used as the APNS topic."
  default     = "live.logmaster.app"
}

variable "apns_production" {
  type        = bool
  description = "Use APNS production endpoint. Defaults to true for production workspace, false for staging."
  default     = null
}

variable "alb_certificate_arn" {
  type        = string
  description = "ACM certificate ARN for the ALB HTTPS listener (must be in the same region)."
}

variable "apply_tenant_database_resources" {
  type        = bool
  default     = false
  description = "Create tenant role/database via the postgresql provider (requires VPC access to shared RDS). Leave false for local apply; use scripts/provision-tenant-db.sh or scripts/run-tenant-db-apply.sh instead."
}

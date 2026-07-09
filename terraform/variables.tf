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

variable "network_state_bucket" {
  type        = string
  description = "S3 bucket holding the network stack state (same as bootstrap output)."
}

variable "network_state_key" {
  type    = string
  default = "network/terraform.tfstate"
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

variable "db_name" {
  type    = string
  default = "logmaster"
}

variable "db_username" {
  type    = string
  default = "logmaster"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_backup_retention_days" {
  type    = number
  default = 1
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_skip_final_snapshot" {
  type    = bool
  default = true
}

variable "db_deletion_protection" {
  type    = bool
  default = false
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
  description = "From address stored in Secrets Manager (must be on a verified SES identity for this account/region)."
}

variable "ses_configuration_set" {
  type        = string
  default     = ""
  description = "Non-empty creates aws_sesv2_configuration_set and sets ECS env SES_CONFIGURATION_SET. Leave empty to skip."
}

variable "ses_domain_name" {
  type        = string
  default     = ""
  description = "e.g. logmaster.live or staging.logmaster.live — non-empty creates aws_sesv2_email_identity with Easy DKIM."
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

variable "google_client_id_secret_arn" {
  type        = string
  description = "Optional existing Secrets Manager ARN for Google OAuth client ID."
  default     = ""
}

variable "google_client_secret_secret_arn" {
  type        = string
  description = "Optional existing Secrets Manager ARN for Google OAuth client secret."
  default     = ""
}

variable "maptiler_api_key_secret_arn" {
  type        = string
  description = "Optional existing Secrets Manager ARN for MapTiler API key."
  default     = ""
}

variable "alb_certificate_arn" {
  type        = string
  description = "ACM certificate ARN for the ALB HTTPS listener (must be in the same region)."
}

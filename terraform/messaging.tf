# One globally named production bucket; other environments must choose a unique name.
variable "message_media_bucket_name" {
  type        = string
  default     = "logmaster-message-media"
  description = "Private messaging media bucket; use a separate name for staging."
}
variable "manage_message_media_bucket" {
  type        = bool
  default     = false
  description = "Enable in exactly one state, or import the existing bucket before managing it."
}
resource "aws_s3_bucket" "message_media" {
  count         = var.manage_message_media_bucket ? 1 : 0
  bucket        = var.message_media_bucket_name
  force_destroy = false
}
resource "aws_s3_bucket_public_access_block" "message_media" {
  count                   = var.manage_message_media_bucket ? 1 : 0
  bucket                  = aws_s3_bucket.message_media[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "message_media" {
  count  = var.manage_message_media_bucket ? 1 : 0
  bucket = aws_s3_bucket.message_media[0].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
resource "aws_s3_bucket_versioning" "message_media" {
  count  = var.manage_message_media_bucket ? 1 : 0
  bucket = aws_s3_bucket.message_media[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

# The existing production bucket can stay externally managed while Terraform
# owns the CORS rules needed for checksum-signed direct uploads.
resource "aws_s3_bucket_cors_configuration" "message_media" {
  count      = local.is_prod || var.manage_message_media_bucket ? 1 : 0
  bucket     = var.message_media_bucket_name
  depends_on = [aws_s3_bucket.message_media]
  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = distinct(concat([local.better_auth_url], var.message_media_upload_origins))
    allowed_headers = ["content-type", "content-length", "x-amz-checksum-sha256", "x-amz-server-side-encryption", "if-none-match"]
    expose_headers  = ["ETag", "x-amz-checksum-sha256"]
    max_age_seconds = 3600
  }
}
variable "message_media_upload_origins" {
  type        = list(string)
  default     = ["http://localhost:3020", "http://127.0.0.1:3020", "capacitor://localhost", "http://localhost", "https://localhost"]
  description = "Additional local development and native WebView origins allowed to use signed uploads."
}
resource "aws_ssm_parameter" "stream_api_key" {
  name  = "${local.ssm_env_prefix}/STREAM_API_KEY"
  type  = "SecureString"
  value = " "
  lifecycle {
    ignore_changes = [value]
  }
}
resource "aws_ssm_parameter" "stream_api_secret" {
  name  = "${local.ssm_env_prefix}/STREAM_API_SECRET"
  type  = "SecureString"
  value = " "
  lifecycle {
    ignore_changes = [value]
  }
}

variable "messaging_cards_bucket_name" {
  type        = string
  default     = "logmaster-messaging-cards"
  description = "Private curated response-card assets; choose a separate bucket for staging."
}
variable "manage_messaging_cards_bucket" {
  type        = bool
  default     = false
  description = "Enable in the owning environment; import an existing bucket before applying."
}
resource "aws_s3_bucket" "messaging_cards" {
  count         = var.manage_messaging_cards_bucket ? 1 : 0
  bucket        = var.messaging_cards_bucket_name
  force_destroy = false
}
resource "aws_s3_bucket_public_access_block" "messaging_cards" {
  count                   = var.manage_messaging_cards_bucket ? 1 : 0
  bucket                  = aws_s3_bucket.messaging_cards[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "messaging_cards" {
  count  = var.manage_messaging_cards_bucket ? 1 : 0
  bucket = aws_s3_bucket.messaging_cards[0].id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_versioning" "messaging_cards" {
  count  = var.manage_messaging_cards_bucket ? 1 : 0
  bucket = aws_s3_bucket.messaging_cards[0].id
  versioning_configuration { status = "Enabled" }
}

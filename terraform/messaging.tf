# One globally named production bucket; other environments must choose a unique name.
variable "message_media_bucket_name" {
  type        = string
  default     = "logmaster-message-media"
  description = "Private messaging media bucket (v2); use a separate name for staging."
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

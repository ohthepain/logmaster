variable "project_name" {
  type        = string
  description = "Short project slug used in resource names."
  default     = "logmaster"
}

variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

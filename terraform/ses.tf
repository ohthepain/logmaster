# Optional SES resources — create only when ses_create_* is true (identities may already exist in the console).

resource "aws_sesv2_configuration_set" "app" {
  count = var.ses_create_configuration_set && var.ses_configuration_set != "" ? 1 : 0

  configuration_set_name = var.ses_configuration_set

  reputation_options {
    reputation_metrics_enabled = true
  }

  delivery_options {
    tls_policy = "REQUIRE"
  }
}

resource "aws_sesv2_email_identity" "domain" {
  count = var.ses_create_domain_identity && var.ses_domain_name != "" ? 1 : 0

  email_identity         = var.ses_domain_name
  configuration_set_name = var.ses_configuration_set != "" ? var.ses_configuration_set : null

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

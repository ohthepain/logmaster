environment = "production"

auth_require_email_verification = true

shared_state_bucket = "shared-aws-tf-state-320205321328"

alb_certificate_arn = "arn:aws:acm:eu-central-1:320205321328:certificate/2c09ddb3-0bbb-4a1e-99a0-b4d1fdada5f1"
alb_listener_rule_priority = 110

ecs_desired_count = 1
ecs_cpu           = 1024
ecs_memory        = 2048

uploads_bucket_force_destroy = false
uploads_cors_allowed_origins = ["https://logmaster.live"]

ses_from_email = "no-reply@logmaster.live"

ses_configuration_set = "logmaster-live"

maptiler_api_key_secret_arn  = "arn:aws:secretsmanager:eu-central-1:320205321328:secret:maptiler-api-key-UwRgH7"
aisstream_api_key_secret_arn = "arn:aws:secretsmanager:eu-central-1:320205321328:secret:aisstream-api-key-OIoEmc"

apns_key_id    = "X9H5N9ZRZQ"
apns_team_id   = "RPGSNMH65P"
apns_bundle_id = "live.logmaster.app"

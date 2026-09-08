environment = "staging"

# shared-aws bootstrap state bucket (holds network + shared stacks)
shared_state_bucket = "shared-aws-tf-state-320205321328"

# ACM certificate for staging.logmaster.live in eu-central-1
alb_certificate_arn = "arn:aws:acm:eu-central-1:320205321328:certificate/28202911-41dc-4562-a6c8-8c1a55133b7f"
alb_listener_rule_priority = 100

ecs_desired_count = 1
# 256/512 MiB is too small for Node + prisma migrate deploy + SSR; Fargate often kills with exit 137 (OOM).
ecs_cpu    = 512
ecs_memory = 2048

uploads_bucket_force_destroy = true
uploads_cors_allowed_origins = ["https://staging.logmaster.live"]

ses_from_email = "no-reply@staging.logmaster.live"

# Parent domain logmaster.live is verified in SES (covers *.logmaster.live senders).
ses_configuration_set = "logmaster-live"

maptiler_api_key_secret_arn  = "arn:aws:secretsmanager:eu-central-1:320205321328:secret:maptiler-api-key-UwRgH7"
aisstream_api_key_secret_arn = "arn:aws:secretsmanager:eu-central-1:320205321328:secret:aisstream-api-key-OIoEmc"

apns_key_id    = "X9H5N9ZRZQ"
apns_team_id   = "RPGSNMH65P"
apns_bundle_id = "live.logmaster.app"

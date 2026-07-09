environment = "staging"

# Must match the S3 bucket from: terraform -chdir=bootstrap output -raw state_bucket
network_state_bucket = "logmaster-tf-state"

# ACM certificate for staging.logmaster.live in eu-central-1
alb_certificate_arn = "arn:aws:acm:eu-central-1:320205321328:certificate/28202911-41dc-4562-a6c8-8c1a55133b7f"

ecs_desired_count = 1
# 256/512 MiB is too small for Node + prisma migrate deploy + SSR; Fargate often kills with exit 137 (OOM).
ecs_cpu           = 512
ecs_memory        = 2048

db_instance_class            = "db.t4g.micro"
db_backup_retention_days     = 1
db_multi_az                  = false
db_skip_final_snapshot       = true
db_deletion_protection       = false
uploads_bucket_force_destroy = true
uploads_cors_allowed_origins = ["https://staging.logmaster.live"]

ses_from_email = "no-reply@staging.logmaster.live"

# Parent domain logmaster.live is verified in SES (covers *.logmaster.live senders).
ses_configuration_set = "logmaster-live"

# Optional: existing Secrets Manager ARNs for third-party credentials
# google_client_id_secret_arn     = "arn:aws:secretsmanager:eu-central-1:ACCOUNT_ID:secret:..."
# google_client_secret_secret_arn = "arn:aws:secretsmanager:eu-central-1:ACCOUNT_ID:secret:..."
# maptiler_api_key_secret_arn     = "arn:aws:secretsmanager:eu-central-1:ACCOUNT_ID:secret:..."

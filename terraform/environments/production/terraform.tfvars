environment = "production"

# Must match the S3 bucket from: terraform -chdir=bootstrap output -raw state_bucket
network_state_bucket = "logmaster-tf-state"

# ACM certificate for logmaster.live in eu-central-1
alb_certificate_arn = "arn:aws:acm:eu-central-1:320205321328:certificate/2c09ddb3-0bbb-4a1e-99a0-b4d1fdada5f1"

ecs_desired_count = 1
ecs_cpu           = 1024
ecs_memory        = 2048

db_instance_class            = "db.t4g.small"
db_backup_retention_days     = 14
db_multi_az                  = true
db_skip_final_snapshot       = false
db_deletion_protection       = true
uploads_bucket_force_destroy = false
uploads_cors_allowed_origins = ["https://logmaster.live"]

ses_from_email = "no-reply@logmaster.live"

# Domain identity verified manually in SES console; reuse its configuration set.
ses_configuration_set = "logmaster-live"

# Optional: existing Secrets Manager ARNs for third-party credentials
# google_client_id_secret_arn     = "arn:aws:secretsmanager:eu-central-1:ACCOUNT_ID:secret:..."
# google_client_secret_secret_arn = "arn:aws:secretsmanager:eu-central-1:ACCOUNT_ID:secret:..."
maptiler_api_key_secret_arn     = "arn:aws:secretsmanager:eu-central-1:320205321328:secret:maptiler-api-key-QqfHsd"
aisstream_api_key_secret_arn    = "arn:aws:secretsmanager:eu-central-1:320205321328:secret:aisstream-api-key-OIoEmc"

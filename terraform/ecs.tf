resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    # value = local.is_prod ? "enabled" : "disabled"
    value = "disabled"
  }
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name_prefix}"
  retention_in_days = local.is_prod ? 30 : 7
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${local.name_prefix}-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_cpu
  memory                   = var.ecs_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name  = "app"
      image = "${aws_ecr_repository.app.repository_url}:${var.environment}"

      portMappings = [
        {
          containerPort = var.app_port
          hostPort      = var.app_port
          protocol      = "tcp"
        }
      ]

      essential = true

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = tostring(var.app_port) },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "S3_BUCKET_PHOTOS", value = aws_s3_bucket.uploads.bucket },
        { name = "S3_BUCKET_GEOJSON", value = aws_s3_bucket.uploads.bucket },
        { name = "BETTER_AUTH_URL", value = local.better_auth_url },
        { name = "TRUSTED_ORIGINS", value = local.better_auth_url },
        { name = "EMAIL_APP_NAME", value = var.email_app_name },
        { name = "AUTH_REQUIRE_EMAIL_VERIFICATION", value = var.auth_require_email_verification ? "true" : "false" },
        { name = "SES_CONFIGURATION_SET", value = var.ses_configuration_set },
        { name = "APNS_PRODUCTION", value = local.apns_production ? "true" : "false" },
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_ssm_parameter.database_url.arn
        },
        {
          name      = "BETTER_AUTH_SECRET"
          valueFrom = aws_ssm_parameter.better_auth_secret.arn
        },
        {
          name      = "GOOGLE_CLIENT_ID"
          valueFrom = aws_ssm_parameter.google_client_id.arn
        },
        {
          name      = "GOOGLE_CLIENT_SECRET"
          valueFrom = aws_ssm_parameter.google_client_secret.arn
        },
        {
          name      = "AWS_SES_FROM_EMAIL"
          valueFrom = aws_ssm_parameter.ses_from_email.arn
        },
        {
          name      = "MAPTILER_API_KEY"
          valueFrom = aws_ssm_parameter.maptiler_api_key.arn
        },
        {
          name      = "AISSTREAM_API_KEY"
          valueFrom = aws_ssm_parameter.aisstream_api_key.arn
        },
        {
          name      = "APNS_KEY"
          valueFrom = aws_ssm_parameter.apns_key.arn
        },
        {
          name      = "APNS_KEY_ID"
          valueFrom = aws_ssm_parameter.apns_key_id.arn
        },
        {
          name      = "APNS_TEAM_ID"
          valueFrom = aws_ssm_parameter.apns_team_id.arn
        },
        {
          name      = "APNS_BUNDLE_ID"
          valueFrom = aws_ssm_parameter.apns_bundle_id.arn
        },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "app"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "app" {
  name            = "${local.name_prefix}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  health_check_grace_period_seconds = 300

  network_configuration {
    subnets          = data.terraform_remote_state.shared.outputs.public_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = var.app_port
  }

  depends_on = [aws_lb_listener_rule.app]
}

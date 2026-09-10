# Migration to shared-aws

Phased migration preserving database data. Order: **staging → production**.

## SSM Parameter Store cutover

Logmaster ECS secrets moved from Secrets Manager JSON secrets to SSM Parameter Store SecureStrings.

### Per environment (staging, then production)

1. Copy existing values (idempotent):

   ```bash
   ./scripts/migrate-secrets-manager-to-ssm.sh staging
   ```

2. Import parameters into Terraform state (skip if Terraform creates parameters on first apply without the migration script):

   ```bash
   ./scripts/import-env-ssm-parameters.sh staging
   ```

3. Apply Terraform (switches ECS `secrets` to parameter ARNs, removes `logmaster-{env}-database` / `logmaster-{env}-app` Secrets Manager secrets when `bootstrap_from_legacy_secrets_manager = true`):

   ```bash
   ./scripts/tf-apply.sh staging
   ```

4. Force a new ECS deployment if tasks still reference an old task definition revision:

   ```bash
   aws ecs update-service --cluster logmaster-staging-cluster --service logmaster-staging-service --force-new-deployment --region eu-central-1
   ```

5. Smoke test: `/api/health`, Google OAuth, map tiles, AIS, iOS push.

6. After **both** environments succeed, set in `environments/*/terraform.tfvars`:

   ```hcl
   bootstrap_from_legacy_secrets_manager = false
   ```

   and run `terraform apply` once per workspace.

7. Optionally delete orphaned account-level Secrets Manager secrets (MapTiler, AISStream, etc.) once tfvars use SSM parameter names only.

Shared RDS master credentials for Terraform DB provisioning remain in Secrets Manager via shared-aws until that stack migrates separately.

## Prerequisites

1. Apply [shared-aws](https://github.com/ohthepain/shared-aws) (`bootstrap` → `network` → `shared`)
2. Add GitHub secret `AWS_SHARED_TF_STATE_BUCKET` = shared-aws bootstrap `state_bucket`
3. Import or create ECR in app state if migrating from network stack:

```bash
cd terraform
terraform workspace select staging
terraform import aws_ecr_repository.app logmaster-app
```

## Per-environment steps

### 1. Apply refactored app terraform

```bash
./scripts/tf-init.sh
./scripts/tf-apply.sh staging
```

If postgresql provider cannot reach private RDS locally:

```bash
SHARED_AWS_ROOT=../shared-aws ./scripts/run-tenant-db-apply.sh staging
```

### 2. Migrate data

```bash
SOURCE_PASSWORD='legacy-password' ./scripts/migrate-staging.sh
# Or for production: adapt migrate-tenant-db.sh with production vars
```

### 3. DNS cutover

```bash
SHARED_AWS_ROOT=../shared-aws ./scripts/cutover-dns-checklist.sh staging.logmaster.live
```

Point `staging.logmaster.live` CNAME → shared ALB DNS (`terraform output -raw shared_alb_dns_name`).

### 4. Soak test (24–48h)

- `curl https://staging.logmaster.live/api/health`
- Google OAuth sign-in
- S3 photo uploads
- iOS push (staging APNS)

### 5. Decommission legacy

```bash
./scripts/decommission-legacy.sh staging
```

### 6. Repeat for production

```bash
./scripts/tf-apply.sh production
SOURCE_PASSWORD='legacy-password' ./scripts/migrate-production.sh
./scripts/decommission-legacy.sh production
```

Use `alb_listener_rule_priority = 110` and `logmaster.live` hostname.

## After all environments

Destroy logmaster `terraform/network` stack (legacy VPC + duplicate ECR if imported):

```bash
cd terraform/network
terraform destroy
```

## Rollback

Revert DNS CNAME to legacy ALB. Legacy RDS/ALB should remain until soak test passes.

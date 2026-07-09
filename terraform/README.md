# AWS infrastructure (Terraform)

Layout:

1. **`bootstrap/`** — run once locally with the **local** backend. Creates versioned S3 state bucket (`{project}-tf-state-{account_id}`) and DynamoDB table `{project}-terraform-locks`.
2. **`network/`** — shared VPC (2 public AZs, IGW, no NAT), plus a **shared** ECR repository `logmaster-app`. Remote state in S3 key `network/terraform.tfstate`.
3. **`/` (this directory)** — application stack per **workspace** `staging` and `production`. Single S3 key `app/terraform.tfstate` with workspace isolation. Reads VPC + ECR from the network state.

Region: **eu-central-1**. Compute: **ECS Fargate ARM64 (Graviton)**. App listens on port **3000**.

Public URLs:

| Environment | Domain |
|-------------|--------|
| staging | https://staging.logmaster.live |
| production | https://logmaster.live |

## Order of operations

1. **Bootstrap** (once per AWS account):

   ```bash
   ./scripts/bootstrap-apply.sh
   ```

   Note the outputs `state_bucket` and `lock_table`.

2. **Network backend config** — copy `terraform/network/backend.hcl.example` → `terraform/network/backend.hcl` and set `bucket` / `dynamodb_table` from bootstrap outputs.

3. **Network stack**:

   ```bash
   ./scripts/network-init.sh
   cd terraform/network && terraform apply
   ```

4. **Environment tfvars** — edit `terraform/environments/staging/terraform.tfvars` and `production/terraform.tfvars`:
   - Set `network_state_bucket` to the bootstrap `state_bucket` value.
   - Set `alb_certificate_arn` to an ACM certificate in **eu-central-1** for each hostname (`staging.logmaster.live`, `logmaster.live`).
   - Optionally set `google_client_*_secret_arn` and `maptiler_api_key_secret_arn` for OAuth and map tiles.

5. **App backend config** — copy `terraform/backend.hcl.example` → `terraform/backend.hcl` with the same bucket and lock table.

6. **App stack** (per environment):

   ```bash
   ./scripts/tf-init.sh
   ./scripts/tf-plan.sh staging
   ./scripts/tf-apply.sh staging
   ./scripts/tf-plan.sh production
   ./scripts/tf-apply.sh production
   ```

The selected workspace **must** match `environment` in the tfvars file (enforced by a `check` block).

## backend.hcl setup

Both `terraform/backend.hcl` (app stack) and `terraform/network/backend.hcl` (network stack) use the same S3 bucket and DynamoDB lock table from bootstrap. Only the `key` differs:

| Stack | S3 key |
|-------|--------|
| network | `network/terraform.tfstate` |
| app | `app/terraform.tfstate` |

GitHub Actions writes `terraform/backend.hcl` at deploy time from environment secrets — you do not commit `backend.hcl`.

## GitHub secrets

Configure these on GitHub environments **`staging`** and **`production`**:

| Secret | Purpose |
|--------|---------|
| `AWS_ROLE_ARN_DEPLOY` | IAM role ARN (OIDC trust to `sts.amazonaws.com`). |
| `AWS_TF_STATE_BUCKET` | Same value as bootstrap `state_bucket` output. |
| `AWS_TF_LOCK_TABLE` | Same value as bootstrap `lock_table` output (e.g. `logmaster-terraform-locks`). |

These are the **only** GitHub secrets required for deploy and staging parking workflows.

The deploy role needs at least: ECR push/pull to `logmaster-app`, `ecs:UpdateService` / `Describe*` on the env cluster and service, and read/write access to Terraform state (S3 + DynamoDB lock table). Narrow ARNs to your account.

### OIDC trust (outside Terraform)

Create an IAM role with a trust policy allowing GitHub Actions from your repo to assume it via OIDC. Workflows use `aws-actions/configure-aws-credentials@v4` with `permissions: id-token: write` and `audience: sts.amazonaws.com`.

## ACM certificate requirement

Request (or import) ACM certificates in **eu-central-1** covering:

- `staging.logmaster.live` — used by staging ALB HTTPS listener
- `logmaster.live` (and optionally `*.logmaster.live`) — used by production ALB

Set each certificate ARN in the matching `terraform/environments/*/terraform.tfvars` as `alb_certificate_arn`.

## DNS requirement

Point your domains to the ALB **outside Terraform** (unless you add Route 53 resources later):

1. After `terraform apply`, get the ALB DNS name:

   ```bash
   cd terraform && terraform workspace select staging
   terraform output alb_dns_name
   ```

2. Create CNAME records:
   - `staging.logmaster.live` → staging ALB DNS name
   - `logmaster.live` → production ALB DNS name

The app sets `BETTER_AUTH_URL` to the canonical HTTPS origin (`https://staging.logmaster.live` or `https://logmaster.live`) for OAuth redirects and trusted origins.

## Deploy flow

```
dev branch push  → CI build/test → build ARM64 image → ECR:staging → ECS force-new-deploy
main branch push → CI build/test → build ARM64 image → ECR:production → ECS force-new-deploy
```

CI jobs (`build-and-test`) run on every push/PR to `main` and `dev`: install pnpm, Node 22, generate Prisma client, typecheck, lint, test, build.

Deploy jobs authenticate via GitHub OIDC, write `backend.hcl`, init Terraform, build/push `{ecr_url}:staging` or `:production`, and force a new ECS deployment.

**First deploy:** run `terraform apply` for each environment before the first CI deploy so ECS service, RDS, secrets, and ALB exist.

## Container image

- Root **Dockerfile**: multi-stage build, **linux/arm64**, Node 22, pnpm 9.15.4.
- Serves TanStack Start via `server-production.mjs` on port **3000**.
- Task definition uses image `{ecr_url}:staging` or `:production` matching the workspace.
- ALB health check: **`/api/health`** (HTTP 200).
- Public traffic: ALB **HTTP 80 → HTTPS 443** redirect, TLS via ACM.

## Database

- **RDS PostgreSQL 16**, not publicly accessible.
- Security group allows port 5432 from ECS tasks only.
- `DATABASE_URL` is created by Terraform and stored in Secrets Manager (`{env}-database` secret); injected into the ECS task definition.
- Do **not** put `DATABASE_URL` in GitHub secrets.

## Database migrations

Each ECS task runs **`prisma migrate deploy`** on startup (`scripts/docker-entrypoint.sh`) before starting the app. RDS is private, so migrations cannot run from GitHub Actions.

For a local emergency run against the real database:

```bash
cd terraform && terraform workspace select staging
export DATABASE_URL="$(terraform output -raw database_url)"
pnpm db:migrate:deploy
```

## Application secrets (Secrets Manager)

Terraform creates per-environment secrets:

| Secret | Keys |
|--------|------|
| `logmaster-{env}-database` | `DATABASE_URL` |
| `logmaster-{env}-app` | `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AWS_SES_FROM_EMAIL`, `MAPTILER_API_KEY` |

Optional third-party values can be pulled from existing account-level Secrets Manager ARNs via tfvars (`google_client_id_secret_arn`, etc.).

ECS task role grants S3 access to the uploads bucket and SES send permissions. No static AWS access keys are injected — the SDK uses the task role.

## S3 uploads

Per-environment private bucket `{project}-{env}-uploads` for boat photos (and geo JSON tiles). Injected as `S3_BUCKET_PHOTOS` and `S3_BUCKET_GEOJSON`.

## Staging parking

Save cost when staging is idle:

```bash
./scripts/staging-down.sh   # ECS desired count 0 + stop RDS
./scripts/staging-up.sh     # start RDS, wait, scale ECS to 1, force-new-deploy
```

GitHub Actions:

- **Staging down** — manual + scheduled (cron `0 19,22 * * *` UTC), concurrency group `staging-ops`.
- **Staging up** — manual only.

### RDS stop/start limits (AWS)

- Stopped instances auto-start after **7 days** if not manually started.
- First start after stop can take several minutes; ECS `health_check_grace_period_seconds` is **300** to allow DB wake and migration time.

## Amazon SES (optional)

The app sends verification, password reset, and magic-link email via SES when `AWS_SES_FROM_EMAIL` is set.

| Variable | Purpose |
|----------|---------|
| `ses_from_email` | Stored in app secret; must be on a verified SES identity in **eu-central-1**. |
| `ses_configuration_set` | Non-empty creates `aws_sesv2_configuration_set` and sets ECS env `SES_CONFIGURATION_SET`. |
| `ses_domain_name` | Non-empty creates `aws_sesv2_email_identity` with Easy DKIM — add DKIM CNAMEs to DNS. |

Without a verified sender, the app logs email content instead of sending (except in development).

## Terraform destroy

Secrets use `lifecycle { prevent_destroy = true }`. To destroy an environment, remove those blocks (or `terraform state rm` the secrets) if you accept losing secret metadata, then:

```bash
terraform workspace select staging
terraform destroy -var-file=environments/staging/terraform.tfvars
```

## State lock issues

If a run dies mid-apply:

```bash
./scripts/tf-force-unlock.sh staging <lock-id>
```

For corrupted local plugin cache, remove `.terraform/` and re-run `terraform init`.

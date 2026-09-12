# AWS infrastructure (Terraform)

Uses **[shared-aws](https://github.com/ohthepain/shared-aws)** for VPC, RDS, and ALB. This stack owns ECS, tenant DB/role, target group, and listener rules.

Layout:

1. **`shared-aws`** (separate repo) — VPC, shared RDS, shared ALB. Remote state key `shared/terraform.tfstate`.
2. **`bootstrap/`** (legacy) — logmaster state bucket; still used for this app's Terraform state.
3. **`/` (this directory)** — application stack per workspace `staging` and `production`. Reads shared-aws outputs via `data.terraform_remote_state.shared`.

See [MIGRATION.md](./MIGRATION.md) for cutover from legacy per-app RDS/ALB.

Region: **eu-central-1**. Compute: **ECS Fargate ARM64**. App listens on port **3000**.

| Environment | Domain | ALB rule priority |
|-------------|--------|-------------------|
| staging | https://staging.logmaster.live | 100 |
| production | https://logmaster.live | 110 |

## Order of operations

1. Apply **shared-aws** (`bootstrap` → `network` → `shared`) — see shared-aws README.
2. Set `shared_state_bucket` in `environments/*/terraform.tfvars` to the shared-aws bootstrap bucket.
3. Add GitHub secret `AWS_SHARED_TF_STATE_BUCKET` for CI deploy jobs.
4. **App backend config** — copy `terraform/backend.hcl.example` → `terraform/backend.hcl` (logmaster state bucket).
5. **App stack** (per environment):

   ```bash
   ./scripts/tf-init.sh
   ./scripts/tf-plan.sh staging
   ./scripts/tf-apply.sh staging
   ```

The selected workspace **must** match `environment` in the tfvars file (enforced by a `check` block).

## Legacy layout (deprecated)

The per-app `terraform/network/` stack (VPC + ECR) and per-env RDS/ALB are replaced by shared-aws. Decommission after migration — see MIGRATION.md.

---

<!-- Original README sections below remain valid for ECS, secrets, SES, deploy flow, etc. -->

# AWS infrastructure (Terraform) — app stack details

Layout (historical reference):

1. **`bootstrap/`** — run once locally with the **local** backend. Creates versioned S3 state bucket (`{project}-tf-state-{account_id}`) and DynamoDB table `{project}-terraform-locks`.
2. **`network/`** — **deprecated** — replaced by shared-aws VPC.
3. **`/` (this directory)** — application stack per **workspace** `staging` and `production`.


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
- `DATABASE_URL` is created by Terraform and stored in SSM Parameter Store (`/logmaster/{env}/DATABASE_URL`); injected into the ECS task definition.
- Do **not** put `DATABASE_URL` in GitHub secrets.

## Database migrations

Each ECS task runs **`prisma migrate deploy`** on startup (`scripts/docker-entrypoint.sh`) before starting the app. RDS is private, so migrations cannot run from GitHub Actions.

For a local emergency run against the real database:

```bash
cd terraform && terraform workspace select staging
export DATABASE_URL="$(terraform output -raw database_url)"
pnpm db:migrate:deploy
```

## Application secrets (SSM Parameter Store)

Terraform creates per-environment **SecureString** parameters under `/logmaster/{env}/`:

| Parameter | ECS env var |
|-----------|-------------|
| `/logmaster/{env}/DATABASE_URL` | `DATABASE_URL` |
| `/logmaster/{env}/BETTER_AUTH_SECRET` | `BETTER_AUTH_SECRET` |
| `/logmaster/{env}/GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_ID` |
| `/logmaster/{env}/GOOGLE_CLIENT_SECRET` | `GOOGLE_CLIENT_SECRET` |
| `/logmaster/{env}/AWS_SES_FROM_EMAIL` | `AWS_SES_FROM_EMAIL` |
| `/logmaster/{env}/MAPTILER_API_KEY` | `MAPTILER_API_KEY` |
| `/logmaster/{env}/AISSTREAM_API_KEY` | `AISSTREAM_API_KEY` |
| `/logmaster/{env}/OPENAI_API_KEY` | `OPENAI_API_KEY` |
| `/logmaster/{env}/APNS_KEY` | `APNS_KEY` |
| `/logmaster/{env}/APNS_KEY_ID` | `APNS_KEY_ID` |
| `/logmaster/{env}/APNS_TEAM_ID` | `APNS_TEAM_ID` |
| `/logmaster/{env}/APNS_BUNDLE_ID` | `APNS_BUNDLE_ID` |

Shared keys (MapTiler, AISStream, OpenAI, Google OAuth, APNS `.p8`) live under `/logmaster/account/*`. Terraform can bootstrap new environments from those account parameters (`*_parameter_name` in tfvars). Do **not** put secret values in tfvars — only parameter **names**.

**Cutover from Secrets Manager:** run `./scripts/migrate-secrets-manager-to-ssm.sh {env}` before `terraform apply`, then set `bootstrap_from_legacy_secrets_manager = false` in tfvars after both environments are migrated. See [MIGRATION.md](./MIGRATION.md#ssm-parameter-store-cutover).

**Google sign-in on deploy:** ECS reads `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from SSM. If those values are empty, sign-in returns `PROVIDER_NOT_FOUND`. After creating the OAuth client in Google Cloud, either:

1. Store credentials in `/logmaster/account/google-client-id` and `google-client-secret`, set `google_client_id_parameter_name` / `google_client_secret_parameter_name` in tfvars, and `terraform apply` (new env bootstrap), or
2. Run `./scripts/set-google-oauth-secrets.sh staging` (reads from local `.env`, updates per-env SSM parameters, forces ECS redeploy).

**Map tiles on deploy:** ECS reads `MAPTILER_API_KEY` from SSM. If it is empty, `/api/map-style-vector` and `/api/map-tiles/...` return **503**. Either ensure `/logmaster/account/maptiler-api-key` exists and set `maptiler_api_key_parameter_name` in tfvars, or run `./scripts/set-maptiler-secrets.sh production`.

**AIS live layer on deploy:** ECS reads `AISSTREAM_API_KEY` from SSM. If it is empty, `/api/ais/vessels` returns **503**. Either ensure `/logmaster/account/aisstream-api-key` exists and set `aisstream_api_key_parameter_name` in tfvars, or run `./scripts/set-aisstream-secrets.sh staging`.

**Asset identification on deploy:** ECS reads `OPENAI_API_KEY` from SSM. If it is empty, asset photo identification and web research are skipped. Either ensure `/logmaster/account/openai-api-key` exists and set `openai_api_key_parameter_name` in tfvars, or run `./scripts/set-openai-secrets.sh staging`.

**iOS push (APNS) on deploy:** ECS reads `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, and `APNS_BUNDLE_ID` from SSM, and `APNS_PRODUCTION` from the task environment (defaults to `true` in production, `false` in staging). If `APNS_KEY` is empty, native iOS push is skipped. Either store the `.p8` in `/logmaster/account/apns-key` with tfvars `apns_key_parameter_name`, or run `./scripts/set-apns-secrets.sh production`.

Keep API keys and `.p8` material in `.env` / gitignored `secrets/apns/` locally; production values live in SSM only.

In Google Cloud, add redirect URIs for each environment:

- `https://staging.logmaster.live/api/auth/callback/google`
- `https://logmaster.live/api/auth/callback/google`

Verify with `curl https://staging.logmaster.live/api/health` — `googleSignIn` should be `true` after redeploy.

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
| `ses_configuration_set` | Passed to ECS as `SES_CONFIGURATION_SET` (e.g. an existing console-managed set like `logmaster-live`). |
| `ses_create_configuration_set` | When `true`, Terraform creates the configuration set named in `ses_configuration_set`. |
| `ses_domain_name` | Domain for optional Terraform-managed identity. |
| `ses_create_domain_identity` | When `true`, Terraform creates `aws_sesv2_email_identity` with Easy DKIM — add DKIM CNAMEs to DNS. |

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

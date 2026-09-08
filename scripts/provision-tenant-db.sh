#!/usr/bin/env bash
# Create or update the tenant role/database on shared RDS from inside the VPC.
#
# Usage:
#   SHARED_AWS_ROOT=/path/to/shared-aws ./scripts/provision-tenant-db.sh production
#
# Password defaults to terraform output database_url for the selected workspace.
set -euo pipefail

ENV="${1:-}"
if [[ -z "$ENV" ]]; then
  echo "Usage: $0 <staging|production> [password]" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for candidate in \
  "${SHARED_AWS_ROOT:-}" \
  "$ROOT/../shared-aws" \
  "$ROOT/../../shared-aws"; do
  if [[ -n "$candidate" && -d "$candidate/terraform/shared" ]]; then
    SHARED_AWS_ROOT="$(cd "$candidate" && pwd)"
    break
  fi
done

if [[ -z "${SHARED_AWS_ROOT:-}" || ! -x "$SHARED_AWS_ROOT/scripts/provision-tenant-db.sh" ]]; then
  echo "Set SHARED_AWS_ROOT to the shared-aws repo path." >&2
  exit 1
fi

cd "$ROOT/terraform"
terraform workspace select "$ENV"

PASSWORD="${2:-}"
if [[ -z "$PASSWORD" ]]; then
  PASSWORD="$(terraform output -raw database_url | python3 -c "from urllib.parse import urlparse; import sys; print(urlparse(sys.stdin.read()).password)")"
fi

exec "$SHARED_AWS_ROOT/scripts/provision-tenant-db.sh" logmaster "$ENV" "$PASSWORD"

#!/bin/sh
set -e
# RDS is private; GitHub Actions cannot reach it. Apply migrations before serving.
echo "[entrypoint] prisma migrate deploy…"
cd /app
npx prisma migrate deploy
echo "[entrypoint] starting app"
exec "$@"

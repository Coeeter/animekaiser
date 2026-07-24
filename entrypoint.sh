#!/bin/sh
set -e

echo "Running Drizzle migrations..."
cd /app/packages/db
bun /app/node_modules/drizzle-kit/bin.cjs migrate --config /app/packages/db/drizzle.config.ts
echo "Drizzle migrations complete."

cd /app/apps/api
exec bun run start

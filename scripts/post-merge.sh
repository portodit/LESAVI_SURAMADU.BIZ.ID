#!/bin/bash
set -e

# Install deps
pnpm install --frozen-lockfile

# Push DB schema changes
pnpm --filter db push

# Copy dashboard dist to nginx public folder
cp -r apps/dashboard/dist/public/* /var/www/lesavi/public/

# Restart API
pm2 restart lesavi-api

#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-${NEXT_PUBLIC_APP_URL:-${NEXT_PUBLIC_SITE_URL:-}}}"
SECRET="${ANALYTICS_DIGEST_SECRET:-}"

if [[ -z "$APP_URL" ]]; then
  echo "APP_URL or NEXT_PUBLIC_APP_URL is required" >&2
  exit 1
fi

if [[ -z "$SECRET" ]]; then
  echo "ANALYTICS_DIGEST_SECRET is required" >&2
  exit 1
fi

curl -sS \
  -H "Authorization: Bearer ${SECRET}" \
  "${APP_URL%/}/api/internal/analytics-digests/run"

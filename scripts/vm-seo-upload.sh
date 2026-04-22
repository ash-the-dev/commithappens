#!/usr/bin/env bash
# Run on the VM after Screaming Frog writes response_codes_all.csv.
# 1) Put Supabase + paths in a root-owned env file (not in the repo), e.g.:
#    export SEO_ENV_FILE=/home/ubuntu/.config/ash-ops/seo.env
# 2) Call this script from your daily crawl job (cron) after the CSV is written.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SEO_ENV_FILE="${SEO_ENV_FILE:-/home/ubuntu/.config/ash-ops/seo.env}"
exec npm run seo:upload-response-report

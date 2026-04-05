#!/usr/bin/env bash
set -euo pipefail

cd /var/www/cbtooll-shared/live-release
./node_modules/.bin/tsx scripts/telegram-monitor-bot.ts

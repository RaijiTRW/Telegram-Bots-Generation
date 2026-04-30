# VDS Auto Deploy

This setup uses GitHub Actions plus a blue/green deployment strategy on the VDS.

## What it does

- every push to `main` triggers `.github/workflows/deploy-vds.yml`
- the workflow uploads the new release to `/var/www/cbtooll-shared/uploads/<sha>`
- the server-side script `/usr/local/bin/cbtooll-deploy` deploys to the inactive color
- the inactive app is built and started on the spare port
- nginx is switched only after the new app passes a health check
- the previously active app is stopped only after the switch

## Server layout

- blue app: `/var/www/cbtooll` on port `3000`
- green app: `/var/www/cbtooll-green` on port `3001`
- shared data: `/var/www/cbtooll-shared`
- shared env: `/var/www/cbtooll-shared/.env.local`
- active color marker: `/var/www/cbtooll-shared/active-color`
- active live symlink: `/var/www/cbtooll-shared/live-release`
- deploy script: `/usr/local/bin/cbtooll-deploy`

## Telegram monitor bot

There is also a separate persistent Telegram monitor bot service template:

- unit file: `deploy/systemd/telegram-monitor-bot.service`
- runtime entrypoint: `scripts/run-telegram-monitor-bot.sh`

The bot expects these variables in the shared env:

- `TELEGRAM_MONITOR_BOT_TOKEN`
- `TELEGRAM_MONITOR_SITE_HEALTH_URL`
- `TELEGRAM_MONITOR_OWNER_CHAT_ID` (optional, first `/start` can claim the chat if omitted)
- `TELEGRAM_MONITOR_STATE_PATH` (recommended: `/var/www/cbtooll-shared/telegram-monitor-bot-state.json`)
- `TELEGRAM_MONITOR_LOG_COMMAND` (optional, defaults to combined journalctl logs)
- `TELEGRAM_MONITOR_CRITICAL_LOG_COMMAND` (optional)
- `TELEGRAM_MONITOR_SERVICES` (optional, comma-separated systemd service names)

## Local AI API on the VDS

The bot editor can use a local OpenAI-compatible API instead of OpenRouter. Put these variables into
`/var/www/cbtooll-shared/.env.local`:

- `AI_API_BASE_URL` - local endpoint, for example `http://127.0.0.1:8000/v1`
- `AI_MODEL` - model name shown/sent by the local API, for example `z-ai/glm-5.1`
- `AI_API_KEY` - optional, only if the local API requires bearer auth

Legacy `OPENROUTER_*` variables are still supported as a fallback.

## Required GitHub Secrets

- `VDS_HOST`
- `VDS_USER`
- `VDS_PORT` (optional, defaults to `22`)
- `VDS_SSH_KEY`

`VDS_SSH_KEY` should be a private key that can SSH into the server user used for deploys.

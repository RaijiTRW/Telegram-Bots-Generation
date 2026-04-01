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
- deploy script: `/usr/local/bin/cbtooll-deploy`

## Required GitHub Secrets

- `VDS_HOST`
- `VDS_USER`
- `VDS_PORT` (optional, defaults to `22`)
- `VDS_SSH_KEY`

`VDS_SSH_KEY` should be a private key that can SSH into the server user used for deploys.

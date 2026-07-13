# Deploying to Cloudflare Workers

The dashboard is deployed as a Cloudflare Worker with static assets and the
Images binding. Production URL:

> https://global-pv-fire-watch.pvfirewatch.workers.dev

## Prerequisites

- A Cloudflare account with a registered `workers.dev` subdomain
  (this project uses `pvfirewatch`).
- An API token created from the **Edit Cloudflare Workers** template.

## Steps

```bash
export CLOUDFLARE_API_TOKEN=<your-token>
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>

# 1. Build the production artifact
npm ci
npm run build

# 2. Patch the generated wrangler config with the runtime bindings the
#    worker entry expects (ASSETS + IMAGES), then deploy.
cd dist/server
node -e '
  const fs = require("fs");
  const d = JSON.parse(fs.readFileSync("wrangler.json", "utf8"));
  d.assets = { directory: "../client", binding: "ASSETS" };
  d.images = { binding: "IMAGES" };
  delete d.dev; delete d.build; delete d.topLevelName;
  fs.writeFileSync("wrangler.json", JSON.stringify(d, null, 1));
'
npx wrangler deploy --config wrangler.json
```

## Notes

- A newly registered `workers.dev` subdomain can take a few minutes before
  TLS certificates propagate; `SSL handshake failure` right after the first
  deploy resolves on its own.
- The `/api/daily-feed` route performs the live public-index check at request
  time with a validated-snapshot fallback, so no cron trigger is required for
  the hosted dashboard itself. The GitHub Actions workflow handles data-update
  pull requests separately.
- To attach a custom domain later, add a Custom Domain to the
  `global-pv-fire-watch` Worker in the Cloudflare dashboard
  (Workers & Pages → global-pv-fire-watch → Settings → Domains & Routes).

# Deploy MEUT on Railway (Postgres)

App path: `harvestcems/modern` (this directory). Parent/ops handle `railway login` and the actual deploy; this doc is the checklist.

## Prerequisites

- Railway CLI authenticated
- This folder as the service root (or set Root Directory to `modern` if the repo root is higher)

## One-time setup

```bash
cd harvestcems/modern
railway init          # create / link a project
railway add           # add the Postgres plugin (or Add Plugin → PostgreSQL in dashboard)
```

### Environment variables

In the Railway service **Variables** tab (or `railway variables`):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference to the Postgres plugin) |
| `NEXTAUTH_SECRET` | Long random string (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Public HTTPS URL, e.g. `https://your-app.up.railway.app` |
| `AUTH_TRUST_HOST` | `true` |

Generate a secret locally:

```bash
openssl rand -base64 32
```

After the first deploy, set `NEXTAUTH_URL` to the Railway-generated domain (or custom domain).

### Build & start (already in `railway.toml`)

- **Build:** `npm ci && npx prisma generate && npm run build`
- **Start:** `npx prisma db push && npm run start`
  - MVP uses `db push` (no migration history yet). Switch to `prisma migrate deploy` once you add migrations.
- **Listen:** `next start -H 0.0.0.0 -p ${PORT:-3000}` (Railway sets `PORT`)

### Deploy

```bash
railway up
# or connect GitHub and enable auto-deploy
```

Optional seed after first deploy (one-shot shell / one-off command):

```bash
railway run npm run db:seed
```

## Local Postgres (optional)

SQLite `prisma/dev.db` is left on disk for reference only; the Prisma schema is **postgresql** only.

```bash
docker compose up -d
cp .env.example .env   # edit NEXTAUTH_* as needed
npx prisma db push
npm run db:seed
npm run dev
```

See also `docs/HOSTING.md`.

## Stripe billing

See `docs/STRIPE.md` for full setup. After `npm run stripe:setup`, add to Railway Variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (from a Dashboard webhook on `/api/webhooks/stripe`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_STARTER_MONTHLY` / `_ANNUAL`
- `STRIPE_PRICE_PRO_MONTHLY` / `_ANNUAL`
- `STRIPE_PRICE_ENTERPRISE_MONTHLY` / `_ANNUAL`
- `STRIPE_PRICE_SEAT_MONTHLY` / `_ANNUAL`

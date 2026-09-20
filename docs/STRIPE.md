# MEUT Stripe billing

Locked list prices (USD) live in `src/lib/billing.ts`:

| Plan | Monthly | Annual (10× = 2 months free) |
|------|---------|------------------------------|
| Starter | $99 | $990 |
| Professional | $199 | $1,990 |
| Enterprise | $399 | $3,990 |
| Extra seat | $19 | $190 |

Facility/seat caps remain in `src/lib/license.ts`. Effective seat limit =
`LICENSE_TIERS[tier].maxSeats + organization.extraSeats`.

## One-time product / price setup

Never commit secrets. Use a test or live secret from the Stripe Dashboard:

```bash
cd harvestcems/modern
export STRIPE_SECRET_KEY=sk_test_...   # or sk_live_...
npm run stripe:setup
```

The script is idempotent (Stripe `lookup_key`s like `meut_starter_monthly`).
It prints env lines to paste into `.env` and Railway.

## Local webhook forwarding

```bash
# Terminal A — app
npm run dev

# Terminal B — Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.

## App routes

| Route | Purpose |
|-------|---------|
| `GET /pricing` | Public pricing (monthly/annual toggle) |
| `POST /api/billing/checkout` | Checkout session (supervisor) or signup metadata |
| `POST /api/billing/portal` | Customer Portal (supervisor) |
| `POST /api/webhooks/stripe` | Signature-verified sync → Organization |

Webhook events handled: `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`.

## Railway env vars

Set all of these on the MEUT service (in addition to `DATABASE_URL` / NextAuth):

| Variable | Notes |
|----------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_…` (or test) |
| `STRIPE_WEBHOOK_SECRET` | From Dashboard → Developers → Webhooks, endpoint `https://<domain>/api/webhooks/stripe` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |
| `STRIPE_PRICE_STARTER_MONTHLY` | From `npm run stripe:setup` |
| `STRIPE_PRICE_STARTER_ANNUAL` | |
| `STRIPE_PRICE_PRO_MONTHLY` | |
| `STRIPE_PRICE_PRO_ANNUAL` | |
| `STRIPE_PRICE_ENTERPRISE_MONTHLY` | |
| `STRIPE_PRICE_ENTERPRISE_ANNUAL` | |
| `STRIPE_PRICE_SEAT_MONTHLY` | |
| `STRIPE_PRICE_SEAT_ANNUAL` | |

After deploy, create the webhook endpoint in Stripe pointing at
`/api/webhooks/stripe` and subscribe to the three events above.

## Prisma fields (`Organization`)

- `stripeCustomerId` (unique, optional)
- `stripeSubscriptionId` (optional)
- `billingInterval` (`MONTHLY` \| `ANNUAL` \| null)
- `extraSeats` (Int, default 0)

Apply with `npx prisma db push` (Railway start already runs push).

## Customer Portal

Enable the Customer Portal in Stripe Dashboard (Settings → Billing → Customer
portal) so **Manage billing** on `/settings` works.

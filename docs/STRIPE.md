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
| `GET /pricing` | Public pricing. Logged-out plan buttons start Checkout |
| `GET /signup` | After payment (`session_id`) creates the org. Without `session_id`, explains that payment is required |
| `GET /billing/return` | Logged-in supervisor Checkout success: sync session, then Settings |
| `POST /api/billing/checkout` | Supervisor Checkout, or logged-out pending-signup Checkout |
| `POST /api/billing/portal` | Customer Portal (supervisor) |
| `POST /api/webhooks/stripe` | Signature-verified sync → Organization |

## Pay first

Public customers pay before an organization exists.

1. Logged-out **Get started** on `/pricing` calls `POST /api/billing/checkout` with no session. Metadata includes `pendingSignup=1`. Success URL is `/signup?checkout=success&tier=…&interval=…&session_id={CHECKOUT_SESSION_ID}`.
2. `signupOrganization` refuses unless that session is complete, paid, and the subscription is billable (`active`, `trialing`, or `past_due`). Claim writes `stripeCustomerId`, `stripeSubscriptionId`, `stripeSubscriptionStatus`, and tier. If claim fails, the new org is deleted.
3. `/signup` without `session_id` does not create an org.
4. After login, staff and customer portal routes redirect to `/pricing?billing=required` when the org is not `CREATOR` and has no billable subscription. `CREATOR` (MEUT Demo / `tw`) is exempt. Seed Acme (`acme_admin`, STARTER, no Stripe) is blocked until a supervisor subscribes.
5. A signed-in supervisor can still change plans from Pricing or Settings. That Checkout returns through `/billing/return`.

`Organization.stripeSubscriptionStatus` is optional. Rows that already have a subscription id and a null status keep access until the next webhook writes a status.

## Maintenance mode

Set `MEUT_MAINTENANCE_MODE=1` or `true` (any other value, including unset, is off) and restart the app. No rebuild is required.

While it is on:

- Logged-out visitors to `/` and `/pricing`, and everyone on `/signup`, see a temporarily-unavailable page with a link to log in.
- `POST /api/billing/checkout` returns **503**.
- Public signup cannot create an organization.
- `/login`, NextAuth, `/terms`, `/privacy`, and the signed-in staff app and customer portal keep working (including CREATOR).

Turn the variable off and restart to reopen signup.

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
| `MEUT_MAINTENANCE_MODE` | Optional. `1` or `true` closes public signup and checkout until go-live |

After deploy, create the webhook endpoint in Stripe pointing at
`/api/webhooks/stripe` and subscribe to the three events above.

## Prisma fields (`Organization`)

- `stripeCustomerId` (unique, optional)
- `stripeSubscriptionId` (optional)
- `stripeSubscriptionStatus` (optional; `active`, `trialing`, `past_due` are billable)
- `billingInterval` (`MONTHLY` \| `ANNUAL` \| null)
- `extraSeats` (Int, default 0)

Apply with `npx prisma db push` (Railway start already runs push).

## Customer Portal

Enable the Customer Portal in Stripe Dashboard (Settings → Billing → Customer
portal) so **Manage billing** on `/settings` works.

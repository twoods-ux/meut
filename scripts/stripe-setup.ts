/**
 * Idempotent Stripe Product + Price setup for MEUT.
 * Usage: STRIPE_SECRET_KEY=sk_... npm run stripe:setup
 * Prints env vars to paste into .env / Railway.
 */
import Stripe from "stripe";
import {
  BILLING_PRICES_USD,
  PRICE_ENV_KEYS,
  PRICE_LOOKUP_KEYS,
} from "../src/lib/billing";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY before running this script.");
  process.exit(1);
}

const stripe = new Stripe(key, {
  apiVersion: "2025-02-24.acacia",
});

type PriceSpec = {
  envKey: keyof typeof PRICE_ENV_KEYS;
  lookupKey: string;
  productName: string;
  productLookup: string;
  unitAmountCents: number;
  interval: "month" | "year";
  nickname: string;
};

const SPECS: PriceSpec[] = [
  {
    envKey: "STARTER_MONTHLY",
    lookupKey: PRICE_LOOKUP_KEYS.STARTER_MONTHLY,
    productName: "MEUT Starter",
    productLookup: "meut_starter",
    unitAmountCents: BILLING_PRICES_USD.STARTER.monthly * 100,
    interval: "month",
    nickname: "Starter monthly",
  },
  {
    envKey: "STARTER_ANNUAL",
    lookupKey: PRICE_LOOKUP_KEYS.STARTER_ANNUAL,
    productName: "MEUT Starter",
    productLookup: "meut_starter",
    unitAmountCents: BILLING_PRICES_USD.STARTER.annual * 100,
    interval: "year",
    nickname: "Starter annual",
  },
  {
    envKey: "PRO_MONTHLY",
    lookupKey: PRICE_LOOKUP_KEYS.PRO_MONTHLY,
    productName: "MEUT Professional",
    productLookup: "meut_pro",
    unitAmountCents: BILLING_PRICES_USD.PROFESSIONAL.monthly * 100,
    interval: "month",
    nickname: "Professional monthly",
  },
  {
    envKey: "PRO_ANNUAL",
    lookupKey: PRICE_LOOKUP_KEYS.PRO_ANNUAL,
    productName: "MEUT Professional",
    productLookup: "meut_pro",
    unitAmountCents: BILLING_PRICES_USD.PROFESSIONAL.annual * 100,
    interval: "year",
    nickname: "Professional annual",
  },
  {
    envKey: "ENTERPRISE_MONTHLY",
    lookupKey: PRICE_LOOKUP_KEYS.ENTERPRISE_MONTHLY,
    productName: "MEUT Enterprise",
    productLookup: "meut_enterprise",
    unitAmountCents: BILLING_PRICES_USD.ENTERPRISE.monthly * 100,
    interval: "month",
    nickname: "Enterprise monthly",
  },
  {
    envKey: "ENTERPRISE_ANNUAL",
    lookupKey: PRICE_LOOKUP_KEYS.ENTERPRISE_ANNUAL,
    productName: "MEUT Enterprise",
    productLookup: "meut_enterprise",
    unitAmountCents: BILLING_PRICES_USD.ENTERPRISE.annual * 100,
    interval: "year",
    nickname: "Enterprise annual",
  },
  {
    envKey: "SEAT_MONTHLY",
    lookupKey: PRICE_LOOKUP_KEYS.SEAT_MONTHLY,
    productName: "MEUT Extra Seat",
    productLookup: "meut_seat",
    unitAmountCents: BILLING_PRICES_USD.EXTRA_SEAT.monthly * 100,
    interval: "month",
    nickname: "Extra seat monthly",
  },
  {
    envKey: "SEAT_ANNUAL",
    lookupKey: PRICE_LOOKUP_KEYS.SEAT_ANNUAL,
    productName: "MEUT Extra Seat",
    productLookup: "meut_seat",
    unitAmountCents: BILLING_PRICES_USD.EXTRA_SEAT.annual * 100,
    interval: "year",
    nickname: "Extra seat annual",
  },
];

async function ensureProduct(
  lookupKey: string,
  name: string
): Promise<Stripe.Product> {
  const existing = await stripe.products.search({
    query: `metadata['lookup_key']:'${lookupKey}'`,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0];

  // Fallback: list by name (older runs without metadata)
  const listed = await stripe.products.list({ limit: 100, active: true });
  const byMeta = listed.data.find((p) => p.metadata?.lookup_key === lookupKey);
  if (byMeta) return byMeta;

  return stripe.products.create({
    name,
    metadata: { lookup_key: lookupKey },
  });
}

async function ensurePrice(spec: PriceSpec, productId: string): Promise<Stripe.Price> {
  const found = await stripe.prices.list({
    lookup_keys: [spec.lookupKey],
    limit: 1,
  });
  if (found.data[0]) return found.data[0];

  return stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: spec.unitAmountCents,
    recurring: { interval: spec.interval },
    lookup_key: spec.lookupKey,
    nickname: spec.nickname,
    metadata: { lookup_key: spec.lookupKey },
  });
}

async function main() {
  const productCache = new Map<string, Stripe.Product>();
  const envLines: string[] = [];

  console.log("Creating / updating MEUT Stripe products & prices…\n");

  for (const spec of SPECS) {
    let product = productCache.get(spec.productLookup);
    if (!product) {
      product = await ensureProduct(spec.productLookup, spec.productName);
      productCache.set(spec.productLookup, product);
      console.log(`Product: ${product.name} (${product.id})`);
    }
    const price = await ensurePrice(spec, product.id);
    const envName = PRICE_ENV_KEYS[spec.envKey];
    envLines.push(`${envName}=${price.id}`);
    console.log(
      `  Price ${spec.lookupKey}: ${price.id}  $${(spec.unitAmountCents / 100).toFixed(0)}/${spec.interval}`
    );
  }

  console.log("\n── Paste into .env / Railway Variables ──\n");
  console.log("# Stripe");
  console.log("STRIPE_SECRET_KEY=sk_…   # from Stripe Dashboard");
  console.log("STRIPE_WEBHOOK_SECRET=whsec_…  # from stripe listen or Dashboard");
  console.log("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_…");
  for (const line of envLines) console.log(line);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * MEUT Stripe billing — locked USD prices + env price ID mapping.
 * Create Products/Prices with: npm run stripe:setup
 */

import type { LicenseTier, SellableTier } from "./license";
import { isLicenseTier, isCreatorTier } from "./license";

export type BillingInterval = "MONTHLY" | "ANNUAL";

export const BILLING_PRICES_USD = {
  STARTER: { monthly: 99, annual: 990 },
  PROFESSIONAL: { monthly: 199, annual: 1990 },
  ENTERPRISE: { monthly: 399, annual: 3990 },
  EXTRA_SEAT: { monthly: 19, annual: 190 },
} as const;

/** Display helpers (locked list prices). */
export function isSellableTier(v: string): v is SellableTier {
  return isLicenseTier(v) && !isCreatorTier(v);
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function tierListPrice(
  tier: SellableTier,
  interval: BillingInterval
): number {
  const row = BILLING_PRICES_USD[tier];
  return interval === "ANNUAL" ? row.annual : row.monthly;
}

export function seatListPrice(interval: BillingInterval): number {
  return interval === "ANNUAL"
    ? BILLING_PRICES_USD.EXTRA_SEAT.annual
    : BILLING_PRICES_USD.EXTRA_SEAT.monthly;
}

/** Env var names for Stripe Price IDs (set after stripe:setup). */
export const PRICE_ENV_KEYS = {
  STARTER_MONTHLY: "STRIPE_PRICE_STARTER_MONTHLY",
  STARTER_ANNUAL: "STRIPE_PRICE_STARTER_ANNUAL",
  PRO_MONTHLY: "STRIPE_PRICE_PRO_MONTHLY",
  PRO_ANNUAL: "STRIPE_PRICE_PRO_ANNUAL",
  ENTERPRISE_MONTHLY: "STRIPE_PRICE_ENTERPRISE_MONTHLY",
  ENTERPRISE_ANNUAL: "STRIPE_PRICE_ENTERPRISE_ANNUAL",
  SEAT_MONTHLY: "STRIPE_PRICE_SEAT_MONTHLY",
  SEAT_ANNUAL: "STRIPE_PRICE_SEAT_ANNUAL",
} as const;

export type PriceLookupKey =
  | "meut_starter_monthly"
  | "meut_starter_annual"
  | "meut_pro_monthly"
  | "meut_pro_annual"
  | "meut_enterprise_monthly"
  | "meut_enterprise_annual"
  | "meut_seat_monthly"
  | "meut_seat_annual";

/** Idempotent lookup_keys used by scripts/stripe-setup.ts */
export const PRICE_LOOKUP_KEYS: Record<
  keyof typeof PRICE_ENV_KEYS,
  PriceLookupKey
> = {
  STARTER_MONTHLY: "meut_starter_monthly",
  STARTER_ANNUAL: "meut_starter_annual",
  PRO_MONTHLY: "meut_pro_monthly",
  PRO_ANNUAL: "meut_pro_annual",
  ENTERPRISE_MONTHLY: "meut_enterprise_monthly",
  ENTERPRISE_ANNUAL: "meut_enterprise_annual",
  SEAT_MONTHLY: "meut_seat_monthly",
  SEAT_ANNUAL: "meut_seat_annual",
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function getTierPriceId(
  tier: SellableTier,
  interval: BillingInterval
): string {
  if (tier === "STARTER") {
    return requireEnv(
      interval === "ANNUAL"
        ? PRICE_ENV_KEYS.STARTER_ANNUAL
        : PRICE_ENV_KEYS.STARTER_MONTHLY
    );
  }
  if (tier === "PROFESSIONAL") {
    return requireEnv(
      interval === "ANNUAL"
        ? PRICE_ENV_KEYS.PRO_ANNUAL
        : PRICE_ENV_KEYS.PRO_MONTHLY
    );
  }
  return requireEnv(
    interval === "ANNUAL"
      ? PRICE_ENV_KEYS.ENTERPRISE_ANNUAL
      : PRICE_ENV_KEYS.ENTERPRISE_MONTHLY
  );
}

export function getSeatPriceId(interval: BillingInterval): string {
  return requireEnv(
    interval === "ANNUAL"
      ? PRICE_ENV_KEYS.SEAT_ANNUAL
      : PRICE_ENV_KEYS.SEAT_MONTHLY
  );
}

/** Build reverse map: priceId → { kind: 'tier', tier } | { kind: 'seat' } */
export function buildPriceIdMap(): Map<
  string,
  { kind: "tier"; tier: LicenseTier; interval: BillingInterval } | {
    kind: "seat";
    interval: BillingInterval;
  }
> {
  const map = new Map<
    string,
    | { kind: "tier"; tier: LicenseTier; interval: BillingInterval }
    | { kind: "seat"; interval: BillingInterval }
  >();

  type Mapped = NonNullable<ReturnType<typeof map.get>>;
  const put = (envKey: string, value: Mapped) => {
    const id = process.env[envKey];
    if (id) map.set(id, value);
  };

  put(PRICE_ENV_KEYS.STARTER_MONTHLY, {
    kind: "tier",
    tier: "STARTER",
    interval: "MONTHLY",
  });
  put(PRICE_ENV_KEYS.STARTER_ANNUAL, {
    kind: "tier",
    tier: "STARTER",
    interval: "ANNUAL",
  });
  put(PRICE_ENV_KEYS.PRO_MONTHLY, {
    kind: "tier",
    tier: "PROFESSIONAL",
    interval: "MONTHLY",
  });
  put(PRICE_ENV_KEYS.PRO_ANNUAL, {
    kind: "tier",
    tier: "PROFESSIONAL",
    interval: "ANNUAL",
  });
  put(PRICE_ENV_KEYS.ENTERPRISE_MONTHLY, {
    kind: "tier",
    tier: "ENTERPRISE",
    interval: "MONTHLY",
  });
  put(PRICE_ENV_KEYS.ENTERPRISE_ANNUAL, {
    kind: "tier",
    tier: "ENTERPRISE",
    interval: "ANNUAL",
  });
  put(PRICE_ENV_KEYS.SEAT_MONTHLY, { kind: "seat", interval: "MONTHLY" });
  put(PRICE_ENV_KEYS.SEAT_ANNUAL, { kind: "seat", interval: "ANNUAL" });

  return map;
}

export function isBillingInterval(v: string): v is BillingInterval {
  return v === "MONTHLY" || v === "ANNUAL";
}

export function parseCheckoutTier(v: unknown): SellableTier | null {
  if (typeof v !== "string") return null;
  return isSellableTier(v) ? v : null;
}

export function parseCheckoutInterval(v: unknown): BillingInterval | null {
  if (typeof v !== "string") return null;
  return isBillingInterval(v) ? v : null;
}

export function parseExtraSeats(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "0"), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), 500);
}

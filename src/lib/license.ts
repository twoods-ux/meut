/**
 * MEUT sellable license tiers — facility (hospital) + user seat caps.
 * Change limits here; enforcement and Settings UI read from this config.
 */

export type LicenseTier = "STARTER" | "PROFESSIONAL" | "ENTERPRISE" | "CREATOR";

export const LICENSE_UPGRADE_MESSAGE =
  "Upgrade your MEUT plan to add more facilities.";

export const SEAT_UPGRADE_MESSAGE =
  "Upgrade your MEUT plan to add more user seats.";

/** null = unlimited (facilities only; seats are always a number) */
export type TierDefinition = {
  id: LicenseTier;
  name: string;
  /** Short UI label (e.g. "Pro") */
  shortName: string;
  /** Hard cap when creating hospitals; null = unlimited */
  maxFacilities: number | null;
  /** Display for facility limit column */
  facilityCapLabel: string;
  /** Hard cap on active users (seats); null = unlimited (Creator only) */
  maxSeats: number | null;
  /** Display for seat limit column */
  seatCapLabel: string;
  description: string;
  highlights: string[];
};

/** Single source of truth for sellable plans */
export const LICENSE_TIERS: Record<LicenseTier, TierDefinition> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    shortName: "Starter",
    maxFacilities: 5,
    facilityCapLabel: "5",
    maxSeats: 2,
    seatCapLabel: "2",
    description: "Smaller biomedical programs and single campuses",
    highlights: [
      "Up to 5 facilities (hospitals)",
      "Up to 2 active user seats",
      "Full CM / PM work orders",
      "Equipment & contracts",
    ],
  },
  PROFESSIONAL: {
    id: "PROFESSIONAL",
    name: "Professional",
    shortName: "Pro",
    maxFacilities: 10,
    facilityCapLabel: "10",
    maxSeats: 5,
    seatCapLabel: "5",
    description: "Multi-site health systems and shared biomed shops",
    highlights: [
      "Up to 10 facilities",
      "Up to 5 active user seats",
      "Everything in Starter",
      "Ideal for regional groups",
    ],
  },
  CREATOR: {
    id: "CREATOR",
    name: "Creator",
    shortName: "Creator",
    maxFacilities: null,
    facilityCapLabel: "Unlimited",
    maxSeats: null,
    seatCapLabel: "Unlimited",
    description: "Platform owner — unlimited facilities and seats (not for sale)",
    highlights: [
      "Unlimited facilities",
      "Unlimited user seats",
      "Full product access",
      "Not billed via Stripe",
    ],
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    shortName: "Enterprise",
    maxFacilities: null,
    facilityCapLabel: "Unlimited",
    maxSeats: 30,
    seatCapLabel: "30",
    description: "Large systems and IDNs — unlimited facilities, 30 seats",
    highlights: [
      "Unlimited facilities",
      "Up to 30 active user seats",
      "Everything in Professional",
      "Sales demo upgrade path",
    ],
  },
};

export type SellableTier = Exclude<LicenseTier, "CREATOR">;

/** Sellable plans only (Creator is not sold via Stripe). */
export const TIER_ORDER: SellableTier[] = [
  "STARTER",
  "PROFESSIONAL",
  "ENTERPRISE",
];

export function getFacilityLimit(tier: LicenseTier): number | null {
  return LICENSE_TIERS[tier].maxFacilities;
}

export function canAddFacility(
  currentCount: number,
  tier: LicenseTier
): boolean {
  const limit = getFacilityLimit(tier);
  if (limit === null) return true;
  return currentCount < limit;
}

/** Usage string like "2 / 10" or "2 / ∞" for unlimited */
export function facilityUsageString(
  currentCount: number,
  tier: LicenseTier
): string {
  const limit = getFacilityLimit(tier);
  if (limit === null) return `${currentCount} / ∞`;
  return `${currentCount} / ${limit}`;
}

/** Base tier seats + purchased extra seats. */
export function getSeatLimit(tier: LicenseTier, extraSeats = 0): number | null {
  const base = LICENSE_TIERS[tier].maxSeats;
  if (base === null) return null;
  const extra = Number.isFinite(extraSeats) ? Math.max(0, Math.floor(extraSeats)) : 0;
  return base + extra;
}

export function isCreatorTier(tier: string): boolean {
  return tier === "CREATOR";
}

export function canAddUser(
  currentActiveCount: number,
  tier: LicenseTier,
  extraSeats = 0
): boolean {
  const limit = getSeatLimit(tier, extraSeats);
  if (limit === null) return true;
  return currentActiveCount < limit;
}

/** Usage string like "2 / 5" (includes extra seats in the cap). */
export function seatUsageString(
  currentActiveCount: number,
  tier: LicenseTier,
  extraSeats = 0
): string {
  const limit = getSeatLimit(tier, extraSeats);
  if (limit === null) return `${currentActiveCount} / ∞`;
  return `${currentActiveCount} / ${limit}`;
}

export function getTierDefinition(tier: LicenseTier): TierDefinition {
  return LICENSE_TIERS[tier];
}

export function isLicenseTier(value: string): value is LicenseTier {
  return value in LICENSE_TIERS;
}

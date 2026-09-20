import { prisma } from "./prisma";
import {
  type LicenseTier,
  canAddFacility,
  canAddUser,
  facilityUsageString,
  getFacilityLimit,
  getSeatLimit,
  getTierDefinition,
  isLicenseTier,
  isCreatorTier,
  LICENSE_UPGRADE_MESSAGE,
  SEAT_UPGRADE_MESSAGE,
  seatUsageString,
} from "./license";
import { requireOrgSession } from "./tenant";

export async function getOrganizationLicense(organizationId: string) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
  return org;
}

/** License + usage for the current user's organization. */
export async function getLicenseState(organizationId?: string) {
  const orgId =
    organizationId ?? (await requireOrgSession()).organizationId;
  const org = await getOrganizationLicense(orgId);
  const tier = (isLicenseTier(org.tier) ? org.tier : "STARTER") as LicenseTier;
  const extraSeats = org.extraSeats ?? 0;
  const [facilityCount, seatCount] = await Promise.all([
    prisma.hospital.count({ where: { organizationId: orgId } }),
    prisma.user.count({ where: { organizationId: orgId, active: true } }),
  ]);
  const limit = getFacilityLimit(tier);
  const seatLimit = getSeatLimit(tier, extraSeats);
  const def = getTierDefinition(tier);
  const creator = isCreatorTier(tier);
  return {
    organizationId: orgId,
    organizationName: org.name,
    organizationSlug: org.slug,
    tier,
    definition: def,
    creatorUnlimited: creator,
    facilityCount,
    limit,
    usage: facilityUsageString(facilityCount, tier),
    canAdd: canAddFacility(facilityCount, tier),
    upgradeMessage: LICENSE_UPGRADE_MESSAGE,
    seatCount,
    seatLimit,
    extraSeats,
    seatUsage: seatUsageString(seatCount, tier, extraSeats),
    canAddUser: canAddUser(seatCount, tier, extraSeats),
    seatUpgradeMessage: SEAT_UPGRADE_MESSAGE,
    billingInterval: org.billingInterval as "MONTHLY" | "ANNUAL" | null,
    stripeCustomerId: org.stripeCustomerId,
    stripeSubscriptionId: org.stripeSubscriptionId,
    lastImportAt: org.lastImportAt,
    lastImportSummary: org.lastImportSummary,
  };
}

export async function assertCanAddFacility(organizationId?: string) {
  const state = await getLicenseState(organizationId);
  if (!state.canAdd) {
    throw new Error(LICENSE_UPGRADE_MESSAGE);
  }
  return state;
}

/** Block creating a new active user when at seat cap. */
export async function assertCanAddUser(organizationId?: string) {
  const state = await getLicenseState(organizationId);
  if (!state.canAddUser) {
    throw new Error(SEAT_UPGRADE_MESSAGE);
  }
  return state;
}

/**
 * Block reactivating an inactive user when at seat cap.
 * No-op if the user is already active or the update is not activating them.
 */
export async function assertCanActivateUser(
  userId: string,
  willBeActive: boolean,
  organizationId?: string
) {
  if (!willBeActive) return;
  const orgId =
    organizationId ?? (await requireOrgSession()).organizationId;
  const existing = await prisma.user.findFirst({
    where: { id: userId, organizationId: orgId },
  });
  if (!existing || existing.active) return;
  await assertCanAddUser(orgId);
}

export async function setLicenseTier(tier: string, organizationId?: string) {
  if (!isLicenseTier(tier)) {
    throw new Error(`Invalid license tier: ${tier}`);
  }
  const orgId =
    organizationId ?? (await requireOrgSession()).organizationId;
  return prisma.organization.update({
    where: { id: orgId },
    data: { tier },
  });
}

/** @deprecated Use getLicenseState — kept for Settings page import metadata. */
export async function getOrCreateOrgSettings(organizationId?: string) {
  const orgId =
    organizationId ?? (await requireOrgSession()).organizationId;
  return getOrganizationLicense(orgId);
}

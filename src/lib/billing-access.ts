/**
 * Pure billing-access rules. Safe to import from client or server code.
 * CREATOR (platform owner) is exempt. Everyone else needs a billable Stripe subscription.
 */

import { isCreatorTier } from "./license";

/** Same set billing sync treats as entitled (dunning past_due keeps access). */
export const BILLABLE_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
] as const;

export type BillableSubscriptionStatus =
  (typeof BILLABLE_SUBSCRIPTION_STATUSES)[number];

export function isBillableSubscriptionStatus(
  status: string | null | undefined
): status is BillableSubscriptionStatus {
  return (
    status === "active" || status === "trialing" || status === "past_due"
  );
}

export type OrganizationAccessInput = {
  tier: string;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
};

/**
 * App access (staff + customer portal).
 * - CREATOR: always (no Stripe subscription).
 * - Missing subscription id: blocked.
 * - Known non-billable status (incomplete, unpaid, canceled, …): blocked.
 * - Subscription id with no stored status: allowed. Those rows predate status tracking;
 *   the next webhook writes a real status.
 */
export function organizationHasAppAccess(org: OrganizationAccessInput): boolean {
  if (isCreatorTier(org.tier)) return true;
  if (!org.stripeSubscriptionId) return false;
  if (!org.stripeSubscriptionStatus) return true;
  return isBillableSubscriptionStatus(org.stripeSubscriptionStatus);
}

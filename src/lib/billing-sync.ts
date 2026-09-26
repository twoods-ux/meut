/**
 * Apply Stripe subscription / checkout state onto Organization.
 */
import type Stripe from "stripe";
import { prisma } from "./prisma";
import {
  buildPriceIdMap,
  type BillingInterval,
} from "./billing";
import type { LicenseTier } from "./license";
import { isCreatorTier, isLicenseTier } from "./license";
import { isBillableSubscriptionStatus } from "./billing-access";
import { getStripe } from "./stripe";

export type OrgBillingUpdate = {
  tier?: LicenseTier;
  billingInterval?: BillingInterval | null;
  extraSeats?: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
};

/** Parse subscription items → tier, interval, extraSeats. */
export function parseSubscriptionItems(
  items: Stripe.SubscriptionItem[]
): {
  tier: LicenseTier | null;
  interval: BillingInterval | null;
  extraSeats: number;
} {
  const map = buildPriceIdMap();
  let tier: LicenseTier | null = null;
  let interval: BillingInterval | null = null;
  let extraSeats = 0;

  for (const item of items) {
    const priceId =
      typeof item.price === "string" ? item.price : item.price?.id;
    if (!priceId) continue;
    const mapped = map.get(priceId);
    if (!mapped) continue;
    if (mapped.kind === "tier") {
      tier = mapped.tier;
      interval = mapped.interval;
    } else if (mapped.kind === "seat") {
      extraSeats += item.quantity ?? 0;
      if (!interval) interval = mapped.interval;
    }
  }

  return { tier, interval, extraSeats };
}

export async function applyBillingToOrganization(
  organizationId: string,
  data: OrgBillingUpdate
) {
  return prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(data.tier ? { tier: data.tier } : {}),
      ...(data.billingInterval !== undefined
        ? { billingInterval: data.billingInterval }
        : {}),
      ...(data.extraSeats !== undefined ? { extraSeats: data.extraSeats } : {}),
      ...(data.stripeCustomerId !== undefined
        ? { stripeCustomerId: data.stripeCustomerId }
        : {}),
      ...(data.stripeSubscriptionId !== undefined
        ? { stripeSubscriptionId: data.stripeSubscriptionId }
        : {}),
      ...(data.stripeSubscriptionStatus !== undefined
        ? { stripeSubscriptionStatus: data.stripeSubscriptionStatus }
        : {}),
    },
  });
}

export async function syncOrganizationFromSubscription(
  organizationId: string,
  subscription: Stripe.Subscription,
  customerId?: string | null
) {
  const items = subscription.items?.data ?? [];
  const { tier, interval, extraSeats } = parseSubscriptionItems(items);

  const existing = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { tier: true },
  });
  const keepCreator = Boolean(existing && isCreatorTier(existing.tier));

  const status = subscription.status;
  const billable = isBillableSubscriptionStatus(status);

  if (keepCreator) {
    return applyBillingToOrganization(organizationId, {
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: status,
      billingInterval: interval,
      extraSeats: billable ? extraSeats : 0,
    });
  }

  if (!billable) {
    // Incomplete / unpaid / canceled — keep customer link; deleted handler clears tier.
    // Status is stored so the app gate can block non-billable subscriptions.
    return applyBillingToOrganization(organizationId, {
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: status,
      billingInterval: interval,
      extraSeats: 0,
    });
  }

  return applyBillingToOrganization(organizationId, {
    ...(tier ? { tier } : {}),
    billingInterval: interval,
    extraSeats,
    stripeCustomerId: customerId ?? undefined,
    stripeSubscriptionId: subscription.id,
    stripeSubscriptionStatus: status,
  });
}

export async function clearOrganizationSubscription(organizationId: string) {
  const existing = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { tier: true },
  });
  return applyBillingToOrganization(organizationId, {
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: null,
    billingInterval: null,
    extraSeats: 0,
    ...(existing && isCreatorTier(existing.tier) ? {} : { tier: "STARTER" }),
  });
}

/** Resolve organizationId from Stripe customer / subscription metadata. */
export async function findOrgIdFromStripe(opts: {
  customerId?: string | null;
  organizationIdMeta?: string | null;
  subscriptionId?: string | null;
}): Promise<string | null> {
  if (opts.organizationIdMeta) {
    const org = await prisma.organization.findUnique({
      where: { id: opts.organizationIdMeta },
      select: { id: true },
    });
    if (org) return org.id;
  }
  if (opts.customerId) {
    const byCustomer = await prisma.organization.findUnique({
      where: { stripeCustomerId: opts.customerId },
      select: { id: true },
    });
    if (byCustomer) return byCustomer.id;
  }
  if (opts.subscriptionId) {
    const bySub = await prisma.organization.findFirst({
      where: { stripeSubscriptionId: opts.subscriptionId },
      select: { id: true },
    });
    if (bySub) return bySub.id;
  }
  return null;
}

export async function getOrCreateStripeCustomer(opts: {
  organizationId: string;
  email?: string | null;
  name?: string | null;
}): Promise<string> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: opts.organizationId },
  });
  if (org.stripeCustomerId) return org.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: opts.email || undefined,
    name: opts.name || org.name,
    metadata: {
      organizationId: org.id,
      organizationSlug: org.slug,
    },
  });
  await prisma.organization.update({
    where: { id: org.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/** Apply checkout session metadata when org may not yet be linked. */
export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripe = getStripe();
  const meta = session.metadata ?? {};
  const organizationId =
    meta.organizationId ||
    (await findOrgIdFromStripe({
      customerId:
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id,
    }));

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  // Metadata fallbacks (set at checkout create time)
  const metaTier =
    meta.tier && isLicenseTier(meta.tier) && !isCreatorTier(meta.tier)
      ? meta.tier
      : null;
  const metaInterval =
    meta.interval === "MONTHLY" || meta.interval === "ANNUAL"
      ? meta.interval
      : null;
  const metaExtra = parseInt(meta.extraSeats || "0", 10) || 0;

  if (!organizationId) {
    // Signup-before-claim: nothing to write yet; signup will claim via session_id
    console.info(
      "[stripe] checkout.session.completed without organizationId — awaiting signup claim",
      session.id
    );
    return { claimed: false as const, sessionId: session.id };
  }

  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
    await syncOrganizationFromSubscription(
      organizationId,
      sub,
      customerId
    );
    // Ensure metadata tier wins if price map incomplete in env
    const parsed = parseSubscriptionItems(sub.items.data);
    if (!parsed.tier && metaTier) {
      await applyBillingToOrganization(organizationId, {
        tier: metaTier,
        billingInterval: metaInterval,
        extraSeats: parsed.extraSeats || metaExtra,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      });
    }
  } else {
    await applyBillingToOrganization(organizationId, {
      ...(metaTier ? { tier: metaTier } : {}),
      billingInterval: metaInterval,
      extraSeats: metaExtra,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionStatus: null,
    });
  }

  return { claimed: true as const, organizationId };
}

function customerIdFromSession(session: Stripe.Checkout.Session): string | null {
  return typeof session.customer === "string"
    ? session.customer
    : session.customer?.id ?? null;
}

function isExpandedSubscription(
  subscription: Stripe.Checkout.Session["subscription"]
): subscription is Stripe.Subscription {
  return Boolean(subscription) && typeof subscription !== "string";
}

/**
 * Public pay-first Checkout: completed, paid, billable subscription, not already linked.
 * Does not create or update an organization.
 */
export async function assertPendingSignupCheckoutAvailable(
  checkoutSessionId: string
) {
  const { session, subscription } = await loadPendingSignupSession(
    checkoutSessionId
  );
  await assertCheckoutUnclaimed(session, subscription.id);
  return { session, subscription };
}

async function loadPendingSignupSession(checkoutSessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["subscription"],
  });
  if (session.metadata?.pendingSignup !== "1") {
    throw new Error(
      "This checkout session cannot be used to create an organization"
    );
  }
  if (session.mode !== "subscription") {
    throw new Error("Checkout session is not a subscription");
  }
  if (session.status !== "complete") {
    throw new Error(
      "Checkout is not complete. Finish payment before creating an organization."
    );
  }
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    throw new Error(
      "Payment is not complete yet. Wait for Stripe to finish processing, then try again."
    );
  }
  if (!isExpandedSubscription(session.subscription)) {
    throw new Error("Checkout session has no subscription");
  }
  if (!isBillableSubscriptionStatus(session.subscription.status)) {
    throw new Error(
      "Subscription is not active. Complete payment before creating an organization."
    );
  }
  return { session, subscription: session.subscription };
}

async function assertCheckoutUnclaimed(
  session: Stripe.Checkout.Session,
  subscriptionId: string
) {
  const metaOrg = session.metadata?.organizationId;
  if (metaOrg) {
    const linked = await prisma.organization.findUnique({
      where: { id: metaOrg },
      select: { id: true },
    });
    if (linked) {
      throw new Error("This payment is already linked to an organization");
    }
  }
  const customerId = customerIdFromSession(session);
  const existing = await prisma.organization.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscriptionId },
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ],
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error("This payment is already linked to an organization");
  }
}

async function stampStripeOrganization(
  organizationId: string,
  session: Stripe.Checkout.Session,
  subscription: Stripe.Subscription
) {
  const stripe = getStripe();
  const customerId = customerIdFromSession(session);
  try {
    await stripe.subscriptions.update(subscription.id, {
      metadata: {
        ...(subscription.metadata || {}),
        organizationId,
        pendingSignup: "0",
      },
    });
    if (customerId) {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted) {
        await stripe.customers.update(customerId, {
          metadata: {
            ...(customer.metadata || {}),
            organizationId,
          },
        });
      }
    }
  } catch (err) {
    console.error("[stripe] organization metadata stamp failed", err);
  }
}

/** After signup: link a completed pending-signup Checkout Session to the new organization. */
export async function claimCheckoutSessionForOrg(
  organizationId: string,
  checkoutSessionId: string
) {
  const { session, subscription } = await loadPendingSignupSession(
    checkoutSessionId
  );
  await assertCheckoutUnclaimed(session, subscription.id);
  session.metadata = {
    ...(session.metadata || {}),
    organizationId,
  };
  const result = await handleCheckoutCompleted(session);
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripeSubscriptionStatus: true,
    },
  });
  if (
    !org?.stripeCustomerId ||
    !org.stripeSubscriptionId ||
    !isBillableSubscriptionStatus(org.stripeSubscriptionStatus)
  ) {
    throw new Error("Payment could not be applied to the organization");
  }
  await stampStripeOrganization(organizationId, session, subscription);
  return result;
}

/**
 * Logged-in supervisor return URL. Applies a Checkout Session that was created
 * for this organization (not a pending public signup).
 */
export async function finalizeSupervisorCheckout(
  organizationId: string,
  checkoutSessionId: string
) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["subscription"],
  });
  if (session.metadata?.organizationId !== organizationId) {
    throw new Error("Checkout session does not belong to this organization");
  }
  if (session.metadata?.pendingSignup === "1") {
    throw new Error(
      "This checkout session is for a new organization signup"
    );
  }
  if (session.status !== "complete") {
    throw new Error("Checkout session is not complete");
  }
  await handleCheckoutCompleted(session);
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      tier: true,
      stripeSubscriptionId: true,
      stripeSubscriptionStatus: true,
    },
  });
  if (!org) throw new Error("Organization not found");
  if (isCreatorTier(org.tier)) return org;
  if (
    !org.stripeSubscriptionId ||
    (org.stripeSubscriptionStatus &&
      !isBillableSubscriptionStatus(org.stripeSubscriptionStatus))
  ) {
    throw new Error(
      "Subscription is not active yet. Refresh this page in a moment or contact support."
    );
  }
  return org;
}

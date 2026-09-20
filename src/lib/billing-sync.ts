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
import { isLicenseTier } from "./license";
import { getStripe } from "./stripe";

export type OrgBillingUpdate = {
  tier?: LicenseTier;
  billingInterval?: BillingInterval | null;
  extraSeats?: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
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

  const status = subscription.status;
  const billable =
    status === "active" || status === "trialing" || status === "past_due";

  if (!billable) {
    // Incomplete / unpaid / canceled — keep customer link; deleted handler clears tier
    return applyBillingToOrganization(organizationId, {
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscription.id,
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
  });
}

export async function clearOrganizationSubscription(organizationId: string) {
  return applyBillingToOrganization(organizationId, {
    stripeSubscriptionId: null,
    billingInterval: null,
    extraSeats: 0,
    tier: "STARTER",
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
  const metaTier = meta.tier && isLicenseTier(meta.tier) ? meta.tier : null;
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
    });
  }

  return { claimed: true as const, organizationId };
}

/** After signup: link a completed Checkout Session to the new organization. */
export async function claimCheckoutSessionForOrg(
  organizationId: string,
  checkoutSessionId: string
) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["subscription"],
  });
  if (session.status !== "complete" && session.payment_status === "unpaid") {
    throw new Error("Checkout session is not complete");
  }
  // Stamp organizationId onto session/subscription metadata via org update path
  session.metadata = {
    ...(session.metadata || {}),
    organizationId,
  };
  return handleCheckoutCompleted(session);
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getSeatPriceId,
  getTierPriceId,
  parseCheckoutInterval,
  parseCheckoutTier,
  parseExtraSeats,
} from "@/lib/billing";
import { getOrCreateStripeCustomer } from "@/lib/billing-sync";
import { organizationHasAppAccess } from "@/lib/billing-access";
import { isCreatorTier } from "@/lib/license";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  tier?: string;
  interval?: string;
  extraSeats?: number | string;
  /** When buying only additional seats on an existing subscription */
  seatsOnly?: boolean;
  customerEmail?: string;
  successPath?: string;
  cancelPath?: string;
};

/**
 * POST /api/billing/checkout
 * Supervisor (auth) → Checkout for their org. Success returns through /billing/return.
 * Logged-out signup → pendingSignup Checkout; success → /signup?session_id=
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const tier = parseCheckoutTier(body.tier);
    const interval = parseCheckoutInterval(body.interval ?? "MONTHLY");
    const extraSeats = parseExtraSeats(body.extraSeats);
    const seatsOnly = Boolean(body.seatsOnly);

    if (!interval) {
      return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
    }
    if (!seatsOnly && !tier) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }
    if (seatsOnly && extraSeats < 1) {
      return NextResponse.json(
        { error: "extraSeats must be >= 1 for seatsOnly" },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const sessionOrgId = session?.user?.organizationId;

    // Organization is taken from the signed-in supervisor only.
    // Logged-out Checkout is always a pending signup (claimed after payment).
    let organizationId: string | null = null;
    if (session?.user?.id) {
      if (role !== "SUPERVISOR") {
        return NextResponse.json(
          { error: "Only supervisors can manage billing" },
          { status: 403 }
        );
      }
      organizationId = sessionOrgId ?? null;
      if (!organizationId) {
        return NextResponse.json(
          { error: "No organization on session" },
          { status: 400 }
        );
      }
    } else if (seatsOnly) {
      return NextResponse.json(
        { error: "Sign in as a supervisor to add seats" },
        { status: 401 }
      );
    }

    let orgHasAccess = false;
    let orgName: string | null = null;
    let orgRecord:
      | {
          name: string;
          stripeSubscriptionId: string | null;
          billingInterval: string | null;
        }
      | null = null;
    if (organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) {
        return NextResponse.json(
          { error: "Organization not found" },
          { status: 404 }
        );
      }
      if (isCreatorTier(org.tier)) {
        return NextResponse.json(
          { error: "Creator organizations are not billed through Stripe" },
          { status: 400 }
        );
      }
      orgHasAccess = organizationHasAppAccess(org);
      orgName = org.name;
      orgRecord = org;
    }

    const stripe = getStripe();
    const appUrl = getAppUrl();

    if (seatsOnly && orgRecord?.stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(orgRecord.stripeSubscriptionId, {
        expand: ["items.data.price"],
      });
      const seatPriceId = getSeatPriceId(
        (orgRecord.billingInterval as "MONTHLY" | "ANNUAL") || interval
      );
      const existingSeat = sub.items.data.find((item) => {
        const pid = typeof item.price === "string" ? item.price : item.price.id;
        return pid === seatPriceId;
      });
      if (existingSeat) {
        await stripe.subscriptionItems.update(existingSeat.id, {
          quantity: (existingSeat.quantity ?? 0) + extraSeats,
        });
      } else {
        await stripe.subscriptionItems.create({
          subscription: orgRecord.stripeSubscriptionId,
          price: seatPriceId,
          quantity: extraSeats,
        });
      }
      return NextResponse.json({
        ok: true,
        mode: "subscription_update",
        message: "Seats added to subscription",
      });
    }

    const line_items: { price: string; quantity: number }[] = [];

    // New Checkout always includes the plan price when a tier is provided.
    // seatsOnly + existing subscription returns early via subscriptionItems update.
    if (tier) {
      line_items.push({
        price: getTierPriceId(tier, interval),
        quantity: 1,
      });
    }
    if (extraSeats > 0) {
      line_items.push({
        price: getSeatPriceId(interval),
        quantity: extraSeats,
      });
    }
    if (line_items.length === 0) {
      return NextResponse.json(
        { error: "No line items to checkout" },
        { status: 400 }
      );
    }

    const metadata: Record<string, string> = {
      interval,
      extraSeats: String(extraSeats),
      seatsOnly: seatsOnly ? "1" : "0",
    };
    if (tier) metadata.tier = tier;
    if (organizationId) metadata.organizationId = organizationId;

    let customer: string | undefined;
    let customer_email: string | undefined;

    if (organizationId && orgRecord) {
      customer = await getOrCreateStripeCustomer({
        organizationId,
        email: session?.user?.email,
        name: orgName || undefined,
      });
    } else {
      // Public / signup Checkout — claim later via session_id
      customer_email = body.customerEmail || undefined;
      metadata.pendingSignup = "1";
    }

    const successPath =
      body.successPath ||
      (organizationId
        ? "/billing/return?session_id={CHECKOUT_SESSION_ID}"
        : `/signup?checkout=success&tier=${tier}&interval=${interval}&session_id={CHECKOUT_SESSION_ID}`);
    const cancelPath =
      body.cancelPath ||
      (organizationId && orgHasAccess
        ? "/settings?billing=cancel"
        : "/pricing?billing=cancel");

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      customer_email: customer ? undefined : customer_email,
      line_items,
      success_url: successPath.startsWith("http")
        ? successPath
        : `${appUrl}${successPath.startsWith("/") ? "" : "/"}${successPath}`,
      cancel_url: cancelPath.startsWith("http")
        ? cancelPath
        : `${appUrl}${cancelPath.startsWith("/") ? "" : "/"}${cancelPath}`,
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: true,
      client_reference_id: organizationId || undefined,
    });

    return NextResponse.json({ url: checkout.url, sessionId: checkout.id });
  } catch (err) {
    console.error("[billing/checkout]", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

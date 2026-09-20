import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  clearOrganizationSubscription,
  findOrgIdFromStripe,
  handleCheckoutCompleted,
  syncOrganizationFromSubscription,
} from "@/lib/billing-sync";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Stripe needs the raw body for signature verification. */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      getStripeWebhookSecret()
    );
  } catch (err) {
    console.error("[stripe webhook] signature verify failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        const orgId = await findOrgIdFromStripe({
          customerId,
          organizationIdMeta: sub.metadata?.organizationId,
          subscriptionId: sub.id,
        });
        if (orgId) {
          if (sub.status === "canceled") {
            await clearOrganizationSubscription(orgId);
          } else {
            await syncOrganizationFromSubscription(orgId, sub, customerId);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        const orgId = await findOrgIdFromStripe({
          customerId,
          organizationIdMeta: sub.metadata?.organizationId,
          subscriptionId: sub.id,
        });
        if (orgId) {
          await clearOrganizationSubscription(orgId);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler error", event.type, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

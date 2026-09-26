import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { organizationHasAppAccess } from "./billing-access";

export class BillingRequiredError extends Error {
  constructor() {
    super("An active subscription is required to use MEUT.");
    this.name = "BillingRequiredError";
  }
}

export function isBillingRequiredError(error: unknown): boolean {
  return (
    error instanceof BillingRequiredError ||
    (error instanceof Error && error.name === "BillingRequiredError")
  );
}

const orgBillingSelect = {
  tier: true,
  active: true,
  stripeSubscriptionId: true,
  stripeSubscriptionStatus: true,
} as const;

export async function ensureOrganizationBillable(organizationId: string): Promise<
  { ok: true } | { ok: false; status: number; error: string }
> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: orgBillingSelect,
  });
  if (!org?.active) {
    return { ok: false, status: 403, error: "Organization is not active" };
  }
  if (!organizationHasAppAccess(org)) {
    return {
      ok: false,
      status: 403,
      error: "An active subscription is required to use MEUT.",
    };
  }
  return { ok: true };
}

/** Server actions and session helpers. */
export async function assertOrganizationBillable(organizationId: string) {
  const result = await ensureOrganizationBillable(organizationId);
  if (result.ok) return;
  if (result.error.includes("subscription")) {
    throw new BillingRequiredError();
  }
  throw new Error(result.error);
}

/** Page gate. Pricing and /billing/return stay outside this redirect. */
export async function redirectIfBillingRequired(
  organizationId: string,
  opts?: { customer?: boolean }
) {
  const result = await ensureOrganizationBillable(organizationId);
  if (result.ok) return;
  if (!result.error.includes("subscription")) {
    redirect("/login");
  }
  const params = new URLSearchParams({ billing: "required" });
  if (opts?.customer) params.set("audience", "customer");
  redirect(`/pricing?${params.toString()}`);
}

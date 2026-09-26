import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { finalizeSupervisorCheckout } from "@/lib/billing-sync";

export const dynamic = "force-dynamic";

/**
 * Authenticated Checkout success URL. Confirms the session for this org, then
 * enters the app. Public pending-signup Checkout returns to /signup instead.
 */
export default async function BillingReturnPage({
  searchParams,
}: {
  searchParams?: { session_id?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  const organizationId = session.user.organizationId;
  if (!organizationId || session.user.role !== "SUPERVISOR") {
    redirect("/pricing?billing=required");
  }

  const sessionId = searchParams?.session_id?.trim();
  if (!sessionId) {
    redirect("/pricing?billing=required");
  }

  try {
    await finalizeSupervisorCheckout(organizationId, sessionId);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Could not confirm payment";
    const params = new URLSearchParams({
      billing: "required",
      error: message.replace(/\s+/g, " ").trim().slice(0, 240),
    });
    redirect(`/pricing?${params.toString()}`);
  }

  redirect("/settings?billing=success");
}

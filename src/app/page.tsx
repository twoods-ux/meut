import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirectIfBillingRequired } from "@/lib/billing-gate";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { isMaintenanceMode } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) {
    if (isMaintenanceMode()) return <MaintenanceScreen />;
    redirect("/login");
  }
  if (!session.user?.organizationId) redirect("/login");
  const customer = session.user.role === "CUSTOMER";
  await redirectIfBillingRequired(session.user.organizationId, { customer });
  if (customer) redirect("/portal/inventory");
  redirect("/dashboard");
}

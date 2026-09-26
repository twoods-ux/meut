import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirectIfBillingRequired } from "@/lib/billing-gate";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user?.organizationId) redirect("/login");
  const customer = session.user.role === "CUSTOMER";
  await redirectIfBillingRequired(session.user.organizationId, { customer });
  if (customer) redirect("/portal/inventory");
  redirect("/dashboard");
}

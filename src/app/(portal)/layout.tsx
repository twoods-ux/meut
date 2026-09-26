import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isBillingRequiredError } from "@/lib/billing-gate";
import { requireCustomerSession } from "@/lib/tenant";
import { CustomerSidebar } from "@/components/customer-sidebar";
import { SiteFooter } from "@/components/site-footer";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requireCustomerSession();
  } catch (error) {
    if (isBillingRequiredError(error)) {
      redirect("/pricing?billing=required&audience=customer");
    }
    redirect("/login");
  }

  const hospital = await prisma.hospital.findFirst({
    where: {
      id: session.hospitalId,
      organizationId: session.organizationId,
    },
  });
  if (!hospital) redirect("/login");

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <div className="shrink-0">
        <CustomerSidebar
          userName={session.name}
          facilityName={hospital.name}
        />
      </div>
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Customer Portal
            </p>
            <p className="truncate text-sm font-medium text-slate-600">
              {hospital.name}
            </p>
          </div>
        </div>
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </div>
        <SiteFooter />
      </main>
    </div>
  );
}

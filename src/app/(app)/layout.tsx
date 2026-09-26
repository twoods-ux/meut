import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { redirectIfBillingRequired } from "@/lib/billing-gate";
import { Sidebar } from "@/components/sidebar";
import { SiteFooter } from "@/components/site-footer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user?.organizationId) redirect("/login");
  if (session.user?.role === "CUSTOMER") redirect("/portal/inventory");
  await redirectIfBillingRequired(session.user.organizationId);
  return (
    <div className="flex min-h-screen bg-[var(--background)] print:block print:bg-white">
      <div className="shrink-0 print:hidden">
        <Sidebar
          userName={session.user?.name}
          role={session.user?.role}
          organizationName={session.user?.organizationName}
        />
      </div>
      <main className="flex min-w-0 flex-1 flex-col overflow-auto print:overflow-visible">
        <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8 print:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              M.E.U.T.
            </p>
            <p className="truncate text-sm font-medium text-slate-600">
              {session.user?.organizationName || "Organization"}
            </p>
          </div>
        </div>
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 print:max-w-none print:px-0 print:py-0">
          {children}
        </div>
        <SiteFooter />
      </main>
    </div>
  );
}

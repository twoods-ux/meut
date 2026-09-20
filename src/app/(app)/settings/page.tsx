import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ImportMdbForm } from "@/components/import-mdb-form";
import { ImportCsvForm } from "@/components/import-csv-form";
import { OrgLogoForm } from "@/components/org-logo-form";
import { prisma } from "@/lib/prisma";
import { updateLicenseTier } from "@/lib/actions";
import { getLicenseState } from "@/lib/license-server";
import { requireOrgSession } from "@/lib/tenant";
import { LICENSE_TIERS, TIER_ORDER } from "@/lib/license";
import type { ImportMdbCounts } from "@/lib/import-mdb";
import { cn } from "@/lib/utils";
import { BillingActions } from "@/components/billing/billing-actions";
import type { BillingInterval } from "@/lib/billing";

export const dynamic = "force-dynamic";

function parseLastImport(summary: string | null | undefined): ImportMdbCounts | null {
  if (!summary) return null;
  try {
    return JSON.parse(summary) as ImportMdbCounts;
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user?.role !== "SUPERVISOR") {
    redirect("/dashboard");
  }

  const { organizationId } = await requireOrgSession();
  const license = await getLicenseState(organizationId);
  const orgLogo = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { logoDataUrl: true },
  });
  const hasLogo = Boolean(orgLogo?.logoDataUrl);
  const lastImport = {
    at: license.lastImportAt?.toISOString() ?? null,
    counts: parseLastImport(license.lastImportSummary),
  };

  async function changeTier(formData: FormData) {
    "use server";
    await updateLicenseTier(formData);
  }

  return (
    <div>
      <PageHeader
        title="License & Plan"
        subtitle={`Organization: ${license.organizationName} — facility & seat capacity, Stripe billing (supervisors)`}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current plan
          </p>
          <p className="mt-2 text-2xl font-bold text-[#4070D0]">
            {license.definition.name}
          </p>
          <p className="mt-1 text-sm text-slate-500">{license.definition.description}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Facility usage
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{license.usage}</p>
          <p className="mt-1 text-sm text-slate-500">
            {license.canAdd
              ? "You can add more facilities on this plan."
              : "At capacity — upgrade to add facilities."}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Seat usage
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{license.seatUsage}</p>
          <p className="mt-1 text-sm text-slate-500">
            {license.canAddUser
              ? "You can add more active users on this plan."
              : "At capacity — upgrade to add seats."}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Caps
          </p>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {license.definition.facilityCapLabel} facilities
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {license.seatLimit == null ? "∞" : license.seatLimit} seats
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {license.definition.seatCapLabel} included
            {license.extraSeats > 0
              ? ` + ${license.extraSeats} extra`
              : ""}
          </p>
        </div>
      </div>

      {license.creatorUnlimited ? (
        <div className="card mb-8 border border-emerald-200 bg-emerald-50/60">
          <p className="text-sm font-semibold text-emerald-900">Creator access</p>
          <p className="mt-1 text-sm text-emerald-800">
            This organization has unlimited facilities and seats. Stripe billing does not apply.
          </p>
        </div>
      ) : (
      <div className="mb-8">
        <BillingActions
          currentTier={license.tier}
          billingInterval={
            (license.billingInterval as BillingInterval | null) ?? null
          }
          extraSeats={license.extraSeats}
          hasStripeCustomer={Boolean(license.stripeCustomerId)}
          hasSubscription={Boolean(license.stripeSubscriptionId)}
        />
      </div>
      )}

      <div className="mb-8">
        <OrgLogoForm hasLogo={hasLogo} />
      </div>

      <div className="mb-8">
        <ImportCsvForm />
      </div>

      <div className="mb-8">
        <ImportMdbForm lastImport={lastImport} />
      </div>

      <div className="card mb-8 overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Compare plans</h2>
          <p className="text-sm text-slate-500">
            Facility + seat caps used when selling MEUT. Limits live in{" "}
            <code className="text-xs">src/lib/license.ts</code>.
          </p>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Facilities</th>
                <th>Seats</th>
                <th>Best for</th>
                <th>Includes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TIER_ORDER.map((id) => {
                const t = LICENSE_TIERS[id];
                const current = id === license.tier;
                return (
                  <tr
                    key={id}
                    className={cn(current && "bg-[#4070D0]/5")}
                  >
                    <td className="font-semibold">
                      {t.name}
                      {current ? (
                        <span className="ml-2 badge bg-[#4070D0]/15 text-[#2f56a8]">
                          Current
                        </span>
                      ) : null}
                    </td>
                    <td className="font-medium">{t.facilityCapLabel}</td>
                    <td className="font-medium">{t.seatCapLabel}</td>
                    <td className="text-slate-600">{t.description}</td>
                    <td>
                      <ul className="list-inside list-disc text-sm text-slate-600">
                        {t.highlights.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 font-semibold text-slate-900">Demo: switch plan</h2>
        <p className="mb-4 text-sm text-slate-500">
          For sales demos only — instantly change the licensed tier without Stripe. Prefer Checkout / Manage billing for real subscriptions.
        </p>
        <div className="flex flex-wrap gap-3">
          {TIER_ORDER.map((id) => {
            const t = LICENSE_TIERS[id];
            const current = id === license.tier;
            return (
              <form action={changeTier} key={id}>
                <input type="hidden" name="tier" value={id} />
                <button
                  type="submit"
                  disabled={current}
                  className={cn(
                    "rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                    current
                      ? "cursor-default bg-[#4070D0] text-white"
                      : "border border-slate-200 bg-white text-slate-800 hover:border-[#4070D0] hover:text-[#4070D0]"
                  )}
                >
                  {current ? `✓ ${t.name}` : `Switch to ${t.name}`}
                  <span className="ml-2 font-normal opacity-80">
                    ({t.facilityCapLabel} fac · {t.seatCapLabel} seats)
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      </div>
    </div>
  );
}

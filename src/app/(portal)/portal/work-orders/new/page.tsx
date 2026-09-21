import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui";
import { createCustomerCmWorkOrderAction } from "@/lib/actions";
import {
  requireCustomerSession,
  resolveCustomerFacility,
  customerFacilityEquipmentWhere,
} from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function CustomerNewCmPage({
  searchParams,
}: {
  searchParams: { equipmentId?: string; error?: string };
}) {
  const { organizationId, hospitalId } = await requireCustomerSession();
  const errorMessage = searchParams.error?.trim() || "";

  const facility = await resolveCustomerFacility(organizationId, hospitalId);
  const facilityName = facility?.name || "your facility";

  const equipment = facility
    ? await prisma.equipment.findMany({
        where: customerFacilityEquipmentWhere(organizationId, facility, {
          status: "ACTIVE",
        }),
        orderBy: { controlNum: "asc" },
        take: 1000,
        select: {
          id: true,
          controlNum: true,
          description: true,
          model: true,
          manufacturer: true,
          location: true,
        },
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Request CM work order"
        subtitle={`Facility: ${facilityName}`}
        actions={
          <Link href="/portal/work-orders" className="btn-secondary">
            Back
          </Link>
        }
      />

      {errorMessage ? (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <p className="font-medium">Could not submit CM request</p>
          <p className="mt-1">{errorMessage}</p>
        </div>
      ) : null}

      {equipment.length === 0 ? (
        <EmptyState
          message={`No active equipment at ${facilityName} to request service for.`}
        />
      ) : (
        <form
          action={createCustomerCmWorkOrderAction}
          className="card max-w-2xl space-y-4"
        >
          <p className="text-sm text-slate-600">
            Submit corrective maintenance for equipment at{" "}
            <span className="font-semibold text-slate-900">{facilityName}</span>.
            Choose by <span className="font-semibold">Control #</span>.
          </p>
          <div>
            <label className="label" htmlFor="equipmentId">
              Control # *
            </label>
            <select
              className="input"
              id="equipmentId"
              name="equipmentId"
              required
              defaultValue={searchParams.equipmentId || ""}
            >
              <option value="" disabled>
                Select Control #…
              </option>
              {equipment.map((eq) => {
                const extra = [
                  eq.description || eq.model || "",
                  eq.location || "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <option key={eq.id} value={eq.id}>
                    {`Control # ${eq.controlNum}${extra ? ` — ${extra}` : ""}`}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="priority">
              Priority
            </label>
            <select
              className="input"
              id="priority"
              name="priority"
              defaultValue="ROUTINE"
            >
              <option value="STAT">STAT</option>
              <option value="URGENT">Urgent</option>
              <option value="ROUTINE">Routine</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="workRequested">
              Problem / description *
            </label>
            <textarea
              className="input"
              id="workRequested"
              name="workRequested"
              rows={4}
              required
              placeholder="Describe the issue or request…"
            />
          </div>
          <button type="submit" className="btn-primary">
            Submit CM request
          </button>
        </form>
      )}
    </div>
  );
}

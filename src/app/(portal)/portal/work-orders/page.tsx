import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import {
  requireCustomerSession,
  resolveCustomerFacility,
  customerFacilityEquipmentWhere,
} from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function CustomerWorkOrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; type?: string };
}) {
  const { organizationId, hospitalId } = await requireCustomerSession();
  const status = searchParams.status || "OPEN";
  const typeFilter = searchParams.type || "ALL";

  const facility = await resolveCustomerFacility(organizationId, hospitalId);

  const where: Record<string, unknown> = {
    organizationId,
    ...(facility
      ? {
          equipment: customerFacilityEquipmentWhere(organizationId, facility),
        }
      : { equipment: { hospitalId } }),
  };
  if (typeFilter === "CM" || typeFilter === "PM") {
    where.type = typeFilter;
  }
  if (status === "OPEN") where.status = "OPEN";
  else if (status === "CLOSED") where.status = "CLOSED";

  const wos = await prisma.workOrder.findMany({
    where,
    include: { equipment: true, assignedTech: true },
    orderBy: { dateOpened: "desc" },
    take: 300,
  });

  function chip(href: string, label: string, active: boolean) {
    return (
      <Link
        href={href}
        className={`btn-secondary text-xs ${active ? "ring-2 ring-sky-400" : ""}`}
      >
        {label}
      </Link>
    );
  }

  const base = "/portal/work-orders";
  const typeQ = typeFilter !== "ALL" ? `&type=${typeFilter}` : "";
  const statusQ = status !== "OPEN" ? `status=${status}` : "status=OPEN";

  return (
    <div>
      <PageHeader
        title="Work orders"
        subtitle={`Facility: ${facility?.name || "your facility"}`}
        actions={
          <Link href="/portal/work-orders/new" className="btn-primary">
            Request CM
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {chip(`${base}?status=OPEN${typeQ}`, "Open", status === "OPEN")}
        {chip(`${base}?status=CLOSED${typeQ}`, "Closed", status === "CLOSED")}
        {chip(`${base}?status=ALL${typeQ}`, "All", status === "ALL")}
        <span className="mx-1 hidden h-8 w-px bg-slate-200 sm:inline-block" />
        {chip(
          `${base}?${statusQ}&type=ALL`,
          "CM + PM",
          typeFilter === "ALL"
        )}
        {chip(`${base}?${statusQ}&type=CM`, "CM only", typeFilter === "CM")}
        {chip(`${base}?${statusQ}&type=PM`, "PM only", typeFilter === "PM")}
      </div>

      {wos.length === 0 ? (
        <EmptyState message="No work orders for your facility in this view." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>WO</th>
                <th>Type</th>
                <th>Control #</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Opened</th>
                <th>Tech</th>
                <th>Work Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wos.map((wo) => (
                <tr key={wo.id}>
                  <td>
                    <Link
                      href={`/portal/work-orders/${wo.id}`}
                      className="link-brand"
                    >
                      {wo.woNumber}
                    </Link>
                  </td>
                  <td>
                    <span className="badge bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/15">
                      {wo.type}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/portal/inventory/${wo.equipmentId}`}
                      className="link-brand"
                    >
                      {wo.controlNum || wo.equipment.controlNum}
                    </Link>
                  </td>
                  <td>{wo.priority || (wo.type === "PM" ? "PM" : "—")}</td>
                  <td>
                    <StatusBadge status={wo.status} />
                  </td>
                  <td>{formatDate(wo.dateOpened)}</td>
                  <td>
                    {wo.assignedTech?.name || wo.assignedTechCode || "—"}
                  </td>
                  <td className="max-w-md truncate">
                    {wo.workRequested || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Showing {wos.length} work order(s)
      </p>
    </div>
  );
}

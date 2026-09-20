import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { requireCustomerSession } from "@/lib/tenant";
import { resolveRouteParams } from "@/lib/route-params";

export const dynamic = "force-dynamic";

export default async function CustomerEquipmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id: routeId } = await resolveRouteParams(params);
  const { organizationId, hospitalId } = await requireCustomerSession();
  const equipment = await prisma.equipment.findFirst({
    where: { id: routeId, organizationId, hospitalId },
    include: {
      hospital: true,
      department: true,
      workOrders: {
        where: { organizationId },
        orderBy: { dateOpened: "desc" },
        take: 20,
      },
    },
  });
  if (!equipment) notFound();

  const fields: { label: string; value: string }[] = [
    { label: "Control #", value: equipment.controlNum },
    { label: "Serial", value: equipment.serial || "—" },
    { label: "Manufacturer", value: equipment.manufacturer || "—" },
    { label: "Model", value: equipment.model || "—" },
    { label: "Description", value: equipment.description || "—" },
    { label: "Location", value: equipment.location || "—" },
    { label: "Building", value: equipment.building || "—" },
    { label: "Facility", value: equipment.hospital?.name || "—" },
    {
      label: "Department",
      value: equipment.department?.name || equipment.costCtr || "—",
    },
    { label: "Status", value: equipment.status },
    {
      label: "On PM",
      value: equipment.onPm
        ? `Yes${equipment.pmSchedule1 ? ` (${equipment.pmSchedule1})` : ""}`
        : "No",
    },
    { label: "PM Procedure", value: equipment.pmProc1 || "—" },
    { label: "Comments", value: equipment.comments || "—" },
  ];

  return (
    <div>
      <PageHeader
        title={`Equipment ${equipment.controlNum}`}
        subtitle={equipment.description || "Equipment detail (view only)"}
        actions={
          <Link href="/portal/inventory" className="btn-secondary">
            Back to inventory
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <StatusBadge status={equipment.status} />
        {equipment.onPm ? (
          <span className="badge bg-sky-100 text-sky-800">On PM</span>
        ) : null}
        <span className="text-slate-500">
          {equipment.hospital?.name} ·{" "}
          {equipment.department?.name || equipment.costCtr || "—"}
        </span>
      </div>

      <div className="card mb-8 grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label} className="text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {f.label}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-slate-800">{f.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Maintenance History</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>WO</th>
              <th>Type</th>
              <th>Status</th>
              <th>Opened</th>
              <th>Closed</th>
              <th>Requested</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {equipment.workOrders.map((wo) => (
              <tr key={wo.id}>
                <td>
                  <Link
                    href={`/portal/work-orders/${wo.id}`}
                    className="link-brand"
                  >
                    {wo.woNumber}
                  </Link>
                </td>
                <td>{wo.type}</td>
                <td>
                  <StatusBadge status={wo.status} />
                </td>
                <td>{formatDate(wo.dateOpened)}</td>
                <td>{formatDate(wo.dateClosed)}</td>
                <td className="max-w-xs truncate">{wo.workRequested || "—"}</td>
              </tr>
            ))}
            {equipment.workOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No history
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

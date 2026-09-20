import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { EquipmentForm } from "@/components/equipment-form";
import { formatDate } from "@/lib/utils";
import { requireOrgSession } from "@/lib/tenant";
import { resolveRouteParams } from "@/lib/route-params";

export const dynamic = "force-dynamic";

export default async function EquipmentDetailPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const { id: routeId } = await resolveRouteParams(params);
  const { organizationId } = await requireOrgSession();
  const equipment = await prisma.equipment.findFirst({
    where: { id: routeId, organizationId },
    include: {
      hospital: true,
      department: true,
      workOrders: { orderBy: { dateOpened: "desc" }, take: 20 },
    },
  });
  if (!equipment) notFound();
  const [hospitals, departments] = await Promise.all([
    prisma.hospital.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title={`Equipment ${equipment.controlNum}`}
        subtitle={equipment.description || "Equipment Detail"}
        actions={
          <>
            <Link
              href={`/cm-work-orders/new?equipmentId=${equipment.id}`}
              className="btn-primary"
            >
              Open CM Work Order
            </Link>
            <Link href="/equipment" className="btn-secondary">Browse</Link>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <StatusBadge status={equipment.status} />
        {equipment.onPm ? <span className="badge bg-sky-100 text-sky-800">On PM</span> : null}
        <span className="text-slate-500">
          {equipment.hospital?.name} · {equipment.department?.name || equipment.costCtr || "—"}
        </span>
      </div>
      <EquipmentForm equipment={equipment} hospitals={hospitals} departments={departments} />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Maintenance History</h2>
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
                    href={wo.type === "CM" ? `/cm-work-orders/${wo.id}` : "/pm-work-orders"}
                    className="link-brand"
                  >
                    {wo.woNumber}
                  </Link>
                </td>
                <td>{wo.type}</td>
                <td><StatusBadge status={wo.status} /></td>
                <td>{formatDate(wo.dateOpened)}</td>
                <td>{formatDate(wo.dateClosed)}</td>
                <td className="max-w-xs truncate">{wo.workRequested || "—"}</td>
              </tr>
            ))}
            {equipment.workOrders.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-slate-400">No history</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

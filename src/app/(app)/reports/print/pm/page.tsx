import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/tenant";
import { PrintHeader, PrintToolbar } from "@/components/print-header";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PmListPrintPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const { organizationId, organizationName } = await requireOrgSession();
  const orgBrand = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { logoDataUrl: true },
  });
  const printLogoSrc = orgBrand?.logoDataUrl ? "/api/org/logo" : null;
  const status = searchParams.status || "OPEN";
  const where: { organizationId: string; type: string; status?: string } = {
    organizationId,
    type: "PM",
  };
  if (status === "OPEN") where.status = "OPEN";
  else if (status === "CLOSED") where.status = "CLOSED";

  const wos = await prisma.workOrder.findMany({
    where,
    include: { equipment: true, assignedTech: true },
    orderBy: [{ pmMonth: "desc" }, { woNumber: "desc" }],
    take: 500,
  });

  const org = organizationName || "Organization";
  const statusLabel =
    status === "ALL" ? "All" : status === "CLOSED" ? "Closed" : "Open";

  return (
    <div>
      <PrintToolbar backHref="/reports" backLabel="Back to Reports" />
      <article className="print-document">
        <PrintHeader
          organizationName={org}
          logoSrc={printLogoSrc}
          title="PM Work Orders"
          subtitle={`${statusLabel} · ${wos.length} record(s)`}
        />
        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>WO</th>
                <th>PM month</th>
                <th>Control #</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Tech</th>
                <th>Opened</th>
                <th>Labor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wos.map((wo) => (
                <tr key={wo.id}>
                  <td className="font-medium">{wo.woNumber}</td>
                  <td>{wo.pmMonth || "—"}</td>
                  <td>{wo.controlNum || wo.equipment.controlNum}</td>
                  <td>{wo.pmSchedule1 || wo.equipment.pmSchedule1 || "—"}</td>
                  <td>{wo.status}</td>
                  <td>{wo.assignedTech?.name || wo.assignedTechCode || "—"}</td>
                  <td>{formatDate(wo.dateOpened)}</td>
                  <td>{wo.laborHours != null ? `${wo.laborHours}h` : "—"}</td>
                </tr>
              ))}
              {wos.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    No PM work orders
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

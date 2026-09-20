import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/tenant";
import { PrintHeader, PrintToolbar } from "@/components/print-header";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CmListPrintPage({
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
    type: "CM",
  };
  if (status === "OPEN") where.status = "OPEN";
  else if (status === "CLOSED") where.status = "CLOSED";

  const wos = await prisma.workOrder.findMany({
    where,
    include: { equipment: true, assignedTech: true },
    orderBy: { dateOpened: "desc" },
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
          title="CM Work Orders"
          subtitle={`${statusLabel} · ${wos.length} record(s)`}
        />
        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>WO</th>
                <th>Control #</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Opened</th>
                <th>Tech</th>
                <th>Work requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wos.map((wo) => (
                <tr key={wo.id}>
                  <td className="font-medium">{wo.woNumber}</td>
                  <td>{wo.controlNum || wo.equipment.controlNum}</td>
                  <td>{wo.priority || "—"}</td>
                  <td>{wo.status}</td>
                  <td>{formatDate(wo.dateOpened)}</td>
                  <td>{wo.assignedTech?.name || wo.assignedTechCode || "—"}</td>
                  <td className="max-w-xs truncate">{wo.workRequested || "—"}</td>
                </tr>
              ))}
              {wos.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No CM work orders
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

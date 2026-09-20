import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { requireOrgSession } from "@/lib/tenant";
import { FilePlus, Printer } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CmListPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const { organizationId } = await requireOrgSession();
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
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="CM Work Orders"
        subtitle="Corrective maintenance — open, review, and close"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/cm-work-orders/blank/print" className="btn-secondary">
              <FilePlus className="h-4 w-4" /> Blank form
            </Link>
            <Link href="/cm-work-orders/new" className="btn-primary">
              Open CM
            </Link>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/cm-work-orders?status=OPEN" className={`btn-secondary text-xs ${status === "OPEN" ? "ring-2 ring-sky-400" : ""}`}>Review Open</Link>
        <Link href="/cm-work-orders?status=CLOSED" className={`btn-secondary text-xs ${status === "CLOSED" ? "ring-2 ring-sky-400" : ""}`}>Closed</Link>
        <Link href="/cm-work-orders?status=ALL" className={`btn-secondary text-xs ${status === "ALL" ? "ring-2 ring-sky-400" : ""}`}>Show All</Link>
        <Link
          href={`/reports/print/cm?status=${status === "ALL" ? "ALL" : status}`}
          className="btn-secondary text-xs"
        >
          <Printer className="h-3.5 w-3.5" /> Print list
        </Link>
      </div>
      {wos.length === 0 ? (
        <EmptyState message="No CM work orders in this view." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>WO</th>
                <th>Control #</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Opened</th>
                <th>Tech</th>
                <th>Work Requested</th>
                <th className="print:hidden">Print</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wos.map((wo) => (
                <tr key={wo.id}>
                  <td>
                    <Link href={`/cm-work-orders/${wo.id}`} className="link-brand">
                      {wo.woNumber}
                    </Link>
                  </td>
                  <td>{wo.controlNum || wo.equipment.controlNum}</td>
                  <td>{wo.priority || "—"}</td>
                  <td><StatusBadge status={wo.status} /></td>
                  <td>{formatDate(wo.dateOpened)}</td>
                  <td>{wo.assignedTech?.name || wo.assignedTechCode || "—"}</td>
                  <td className="max-w-md truncate">{wo.workRequested || "—"}</td>
                  <td className="print:hidden">
                    <Link
                      href={`/cm-work-orders/${wo.id}/print`}
                      className="btn-ghost text-xs py-1"
                      title="Print work order"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

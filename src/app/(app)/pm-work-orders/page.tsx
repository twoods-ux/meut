import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { generatePmWorkOrders, closeWorkOrder } from "@/lib/actions";
import { revalidatePath } from "next/cache";
import { requireOrgSession } from "@/lib/tenant";
import { Printer } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PmPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const { organizationId } = await requireOrgSession();
  const status = searchParams.status || "OPEN";
  const where: { organizationId: string; type: string; status?: string } = {
    organizationId,
    type: "PM",
  };
  if (status === "OPEN") where.status = "OPEN";
  else if (status === "CLOSED") where.status = "CLOSED";

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [wos, onPmCount] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      include: { equipment: true, assignedTech: true },
      orderBy: [{ pmMonth: "desc" }, { woNumber: "desc" }],
      take: 300,
    }),
    prisma.equipment.count({
      where: { organizationId, onPm: true, status: "ACTIVE" },
    }),
  ]);

  async function generateAction(formData: FormData) {
    "use server";
    await generatePmWorkOrders(formData);
  }

  async function closeAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    await closeWorkOrder(id, formData);
    revalidatePath("/pm-work-orders");
  }

  return (
    <div>
      <PageHeader
        title="PM Work Orders"
        subtitle="Generate / print and close preventive maintenance work orders"
        actions={
          <Link
            href={`/reports/print/pm?status=${status === "ALL" ? "ALL" : status}`}
            className="btn-secondary"
          >
            <Printer className="h-4 w-4" /> Print list
          </Link>
        }
      />

      <form action={generateAction} className="card mb-8 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <label className="label">Generate for month (YYYY-MM)</label>
          <input className="input w-40" name="month" defaultValue={defaultMonth} required pattern="\d{4}-\d{2}" />
        </div>
        <button type="submit" className="btn-primary">Generate PM WOs</button>
        <p className="w-full text-xs text-slate-500">
          Creates open PM work orders for all active equipment with On PM ({onPmCount} devices). Skips equipment that already has a PM WO for that month.
        </p>
      </form>

      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Link href="/pm-work-orders?status=OPEN" className={`btn-secondary text-xs ${status === "OPEN" ? "ring-2 ring-sky-400" : ""}`}>Review Open</Link>
        <Link href="/pm-work-orders?status=CLOSED" className={`btn-secondary text-xs ${status === "CLOSED" ? "ring-2 ring-sky-400" : ""}`}>Closed</Link>
        <Link href="/pm-work-orders?status=ALL" className={`btn-secondary text-xs ${status === "ALL" ? "ring-2 ring-sky-400" : ""}`}>All</Link>
      </div>

      {wos.length === 0 ? (
        <EmptyState message="No PM work orders. Generate for a month above." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>WO</th>
                <th>PM Month</th>
                <th>Control #</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Tech</th>
                <th>Opened</th>
                <th className="print:hidden">Print</th>
                <th className="print:hidden">Close</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wos.map((wo) => (
                <tr key={wo.id}>
                  <td className="font-medium">{wo.woNumber}</td>
                  <td>{wo.pmMonth || "—"}</td>
                  <td>
                    <Link href={`/equipment/${wo.equipmentId}`} className="link-brand">
                      {wo.controlNum || wo.equipment.controlNum}
                    </Link>
                  </td>
                  <td>{wo.pmSchedule1 || wo.equipment.pmSchedule1 || "—"}</td>
                  <td><StatusBadge status={wo.status} /></td>
                  <td>{wo.assignedTech?.name || wo.assignedTechCode || "—"}</td>
                  <td>{formatDate(wo.dateOpened)}</td>
                  <td className="print:hidden">
                    <Link
                      href={`/pm-work-orders/${wo.id}/print`}
                      className="btn-ghost text-xs py-1"
                      title="Print PM work order"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                  <td className="print:hidden">
                    {wo.status === "OPEN" ? (
                      <form action={closeAction} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={wo.id} />
                        <input type="hidden" name="workPerformed" value="PM completed per procedure" />
                        <input
                          className="input w-16 py-1"
                          name="laborHours"
                          type="number"
                          step="0.25"
                          defaultValue="0.5"
                          title="Labor hours"
                        />
                        <button type="submit" className="btn-secondary text-xs py-1">Close</button>
                      </form>
                    ) : (
                      <span className="text-xs text-slate-400">{wo.laborHours ?? "—"}h</span>
                    )}
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

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { requireOrgSession } from "@/lib/tenant";
import { endOfMonth, startOfDay, startOfMonth } from "@/lib/pm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { organizationId } = await requireOrgSession();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const todayStart = startOfDay(now);

  const [
    equipActive,
    equipOnPm,
    pmOverdue,
    pmDueMonth,
    openCm,
    openPm,
    contractsExpiring,
    recentWos,
  ] = await Promise.all([
    prisma.equipment.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.equipment.count({
      where: { organizationId, onPm: true, status: "ACTIVE" },
    }),
    prisma.equipment.count({
      where: {
        organizationId,
        onPm: true,
        status: "ACTIVE",
        pmNextDue: { lt: todayStart },
      },
    }),
    prisma.equipment.count({
      where: {
        organizationId,
        onPm: true,
        status: "ACTIVE",
        pmNextDue: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.workOrder.count({
      where: { organizationId, type: "CM", status: "OPEN" },
    }),
    prisma.workOrder.count({
      where: { organizationId, type: "PM", status: "OPEN" },
    }),
    prisma.serviceContract.count({
      where: {
        organizationId,
        active: true,
        expirationDate: { lte: new Date(Date.now() + 90 * 86400000) },
      },
    }),
    prisma.workOrder.findMany({
      where: { organizationId },
      take: 8,
      orderBy: { dateOpened: "desc" },
      include: { equipment: true, assignedTech: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Biomedical / clinical equipment maintenance overview"
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active equipment" value={equipActive} tone="brand" />
        <StatCard label="In PM program" value={equipOnPm} tone="emerald" />
        <Link href="/pm-work-orders?due=overdue" className="block">
          <StatCard label="PM overdue" value={pmOverdue} tone="rose" hint="Open PM list" />
        </Link>
        <Link href="/pm-work-orders?due=month" className="block">
          <StatCard label="Due this month" value={pmDueMonth} tone="amber" hint="Open PM list" />
        </Link>
        <StatCard label="Open CM WOs" value={openCm} tone="sky" />
        <StatCard label="Open PM WOs" value={openPm} tone="slate" />
      </div>
      <div className="mb-8">
        <StatCard
          label="Contracts ≤90d"
          value={contractsExpiring}
          tone="rose"
          hint="Expiring soon"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">Recent Work Orders</h2>
        <div className="flex gap-2">
          <Link href="/cm-work-orders" className="btn-secondary text-xs">
            CM WOs
          </Link>
          <Link href="/pm-work-orders" className="btn-secondary text-xs">
            PM WOs
          </Link>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>WO</th>
              <th>Type</th>
              <th>Control #</th>
              <th>Status</th>
              <th>Opened</th>
              <th>Tech</th>
            </tr>
          </thead>
          <tbody>
            {recentWos.map((wo) => (
              <tr key={wo.id}>
                <td className="font-medium">
                  <Link
                    href={
                      wo.type === "CM"
                        ? `/cm-work-orders/${wo.id}`
                        : `/pm-work-orders/${wo.id}`
                    }
                    className="link-brand"
                  >
                    {wo.woNumber}
                  </Link>
                </td>
                <td>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {wo.type}
                  </span>
                </td>
                <td>{wo.controlNum || wo.equipment.controlNum}</td>
                <td>
                  <StatusBadge status={wo.status} />
                </td>
                <td className="text-slate-500">{formatDate(wo.dateOpened)}</td>
                <td>{wo.assignedTech?.name || wo.assignedTechCode || "—"}</td>
              </tr>
            ))}
            {recentWos.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  No work orders yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

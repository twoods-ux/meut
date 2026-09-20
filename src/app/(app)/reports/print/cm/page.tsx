import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/tenant";
import { PrintHeader, PrintToolbar } from "@/components/print-header";
import { formatDate } from "@/lib/utils";
import {
  fetchReportData,
  parseReportFilters,
  statusLabelFor,
  type ReportFilterParams,
} from "@/lib/report-filters";

export const dynamic = "force-dynamic";

export default async function CmListPrintPage({
  searchParams,
}: {
  searchParams: ReportFilterParams;
}) {
  const { organizationId, organizationName } = await requireOrgSession();
  const filters = parseReportFilters({ ...searchParams, type: "cm" });
  const orgBrand = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { logoDataUrl: true },
  });
  const printLogoSrc = orgBrand?.logoDataUrl ? "/api/org/logo" : null;

  const data = await fetchReportData(organizationId, filters);
  const wos = data?.kind === "cm" ? data.rows : [];

  let facilityLabel = "All facilities";
  if (filters.facilityId) {
    const fac = await prisma.hospital.findFirst({
      where: { id: filters.facilityId, organizationId },
      select: { name: true },
    });
    if (fac) facilityLabel = fac.name;
  }
  let techLabel = "All technicians";
  if (filters.techId) {
    const tech = await prisma.user.findFirst({
      where: { id: filters.techId, organizationId },
      select: { name: true },
    });
    if (tech) techLabel = tech.name;
  }

  const datePart =
    filters.from || filters.to
      ? ` · ${filters.from || "…"} → ${filters.to || "…"}`
      : "";

  const org = organizationName || "Organization";
  const statusLabel = statusLabelFor("cm", filters.status);

  return (
    <div>
      <PrintToolbar backHref="/reports" backLabel="Back to Reports" />
      <article className="print-document">
        <PrintHeader
          organizationName={org}
          logoSrc={printLogoSrc}
          title="CM Work Orders"
          subtitle={`${statusLabel} · ${facilityLabel} · ${techLabel}${datePart} · ${wos.length} record(s)`}
        />
        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>WO</th>
                <th>Control #</th>
                <th>Facility</th>
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
                  <td>{wo.equipment.hospital?.name || "—"}</td>
                  <td>{wo.priority || "—"}</td>
                  <td>{wo.status}</td>
                  <td>{formatDate(wo.dateOpened)}</td>
                  <td>{wo.assignedTech?.name || wo.assignedTechCode || "—"}</td>
                  <td className="max-w-xs truncate">{wo.workRequested || "—"}</td>
                </tr>
              ))}
              {wos.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
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

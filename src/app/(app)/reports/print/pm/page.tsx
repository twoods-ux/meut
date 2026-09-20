import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/tenant";
import { PrintHeader, PrintToolbar } from "@/components/print-header";
import { formatDate } from "@/lib/utils";
import {
  fetchReportData,
  parseReportFilters,
  pmResultLabel,
  statusLabelFor,
  type ReportFilterParams,
} from "@/lib/report-filters";
import { resolveSearchParams, oneParam } from "@/lib/route-params";

export const dynamic = "force-dynamic";

export default async function PmListPrintPage({
  searchParams,
}: {
  searchParams:
    | ReportFilterParams
    | Promise<ReportFilterParams>
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, organizationName } = await requireOrgSession();
  const raw = await resolveSearchParams(
    searchParams as Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>
  );
  const filters = parseReportFilters({
    type: "pm",
    status: oneParam(raw.status),
    facility: oneParam(raw.facility),
    from: oneParam(raw.from),
    to: oneParam(raw.to),
    tech: oneParam(raw.tech),
    pmResult: oneParam(raw.pmResult),
    pmMonth: oneParam(raw.pmMonth),
    q: oneParam(raw.q),
  });
  const orgBrand = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { logoDataUrl: true },
  });
  const printLogoSrc = orgBrand?.logoDataUrl ? "/api/org/logo" : null;

  const data = await fetchReportData(organizationId, filters);
  const wos = data?.kind === "pm" ? data.rows : [];

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
  const resultPart =
    filters.pmResult && filters.pmResult !== "ALL"
      ? ` · ${pmResultLabel(filters.pmResult)}`
      : "";
  const monthPart = filters.pmMonth ? ` · PM ${filters.pmMonth}` : "";
  const searchPart = filters.q ? ` · Look-up “${filters.q}”` : "";

  const org = organizationName || "Organization";
  const statusLabel = statusLabelFor("pm", filters.status);

  return (
    <div>
      <PrintToolbar backHref="/pm-work-orders" backLabel="Back to PM list" />
      <article className="print-document">
        <PrintHeader
          organizationName={org}
          logoSrc={printLogoSrc}
          title="PM Work Orders"
          subtitle={`${statusLabel} · ${facilityLabel} · ${techLabel}${datePart}${resultPart}${monthPart}${searchPart} · ${wos.length} record(s)`}
        />
        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>WO</th>
                <th>PM month</th>
                <th>Control #</th>
                <th>Facility</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Result</th>
                <th>Date closed</th>
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
                  <td>{wo.equipment.hospital?.name || "—"}</td>
                  <td>{wo.pmSchedule1 || wo.equipment.pmSchedule1 || "—"}</td>
                  <td>{wo.status}</td>
                  <td>
                    {wo.pmResult === "PASS"
                      ? "Pass"
                      : wo.pmResult === "FAIL"
                        ? "Fail"
                        : "—"}
                  </td>
                  <td>{wo.dateClosed ? formatDate(wo.dateClosed) : "—"}</td>
                  <td>{wo.assignedTech?.name || wo.assignedTechCode || "—"}</td>
                  <td>{formatDate(wo.dateOpened)}</td>
                  <td>{wo.laborHours != null ? `${wo.laborHours}h` : "—"}</td>
                </tr>
              ))}
              {wos.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-slate-400">
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

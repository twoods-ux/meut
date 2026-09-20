import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/tenant";
import { PrintHeader, PrintToolbar } from "@/components/print-header";
import {
  fetchReportData,
  parseReportFilters,
  statusLabelFor,
  type ReportFilterParams,
} from "@/lib/report-filters";

export const dynamic = "force-dynamic";

export default async function EquipmentInventoryPrintPage({
  searchParams,
}: {
  searchParams: ReportFilterParams;
}) {
  const { organizationId, organizationName } = await requireOrgSession();
  const filters = parseReportFilters({ ...searchParams, type: "equipment" });
  const orgBrand = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { logoDataUrl: true },
  });
  const printLogoSrc = orgBrand?.logoDataUrl ? "/api/org/logo" : null;

  const data = await fetchReportData(organizationId, filters);
  const equipment = data?.kind === "equipment" ? data.rows : [];

  let facilityLabel = "All facilities";
  if (filters.facilityId) {
    const fac = await prisma.hospital.findFirst({
      where: { id: filters.facilityId, organizationId },
      select: { name: true },
    });
    if (fac) facilityLabel = fac.name;
  }

  const org = organizationName || "Organization";
  const statusLabel = statusLabelFor("equipment", filters.status);

  return (
    <div>
      <PrintToolbar backHref="/reports" backLabel="Back to Reports" />
      <article className="print-document">
        <PrintHeader
          organizationName={org}
          logoSrc={printLogoSrc}
          title="Equipment Inventory"
          subtitle={`${statusLabel} · ${facilityLabel} · ${equipment.length} device(s)`}
        />
        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>Control #</th>
                <th>Description</th>
                <th>Manufacturer</th>
                <th>Model</th>
                <th>Serial</th>
                <th>Facility</th>
                <th>Department</th>
                <th>Location</th>
                <th>On PM</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipment.map((e) => (
                <tr key={e.id}>
                  <td className="font-medium">{e.controlNum}</td>
                  <td>{e.description || "—"}</td>
                  <td>{e.manufacturer || "—"}</td>
                  <td>{e.model || "—"}</td>
                  <td>{e.serial || "—"}</td>
                  <td>{e.hospital?.name || e.hospId || "—"}</td>
                  <td>{e.department?.name || e.costCtr || "—"}</td>
                  <td>{e.location || "—"}</td>
                  <td>{e.onPm ? "Yes" : "No"}</td>
                  <td>{e.status}</td>
                </tr>
              ))}
              {equipment.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-slate-400">
                    No equipment
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

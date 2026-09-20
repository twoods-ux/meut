import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/tenant";
import { PrintHeader, PrintToolbar } from "@/components/print-header";
import { resolveSearchParams, oneParam } from "@/lib/route-params";
import {
  EQUIPMENT_PRINT_TAKE,
  buildEquipmentWhere,
  equipmentListHref,
  onPmLabel,
  parseEquipmentFilters,
} from "@/lib/equipment-filters";
import {
  columnLabel,
  equipmentPrintCellValue,
  resolveEquipmentPrintColumns,
} from "@/lib/equipment-print-columns";
import { statusLabelFor } from "@/lib/report-filters";

export const dynamic = "force-dynamic";

export default async function EquipmentInventoryPrintPage({
  searchParams,
}: {
  searchParams:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, organizationName, userId } = await requireOrgSession();
  const raw = await resolveSearchParams(searchParams);
  const filters = parseEquipmentFilters({
    q: oneParam(raw.q),
    status: oneParam(raw.status),
    facility: oneParam(raw.facility),
    dept: oneParam(raw.dept),
    onPm: oneParam(raw.onPm),
  });
  const fromEquipment = oneParam(raw.from) === "equipment";
  const colsParam = oneParam(raw.cols);

  const [orgBrand, userPrefs] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logoDataUrl: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { printPrefs: true },
    }),
  ]);
  const printLogoSrc = orgBrand?.logoDataUrl ? "/api/org/logo" : null;
  const columns = resolveEquipmentPrintColumns({
    printPrefs: userPrefs?.printPrefs,
    colsParam,
  });

  const where = buildEquipmentWhere(organizationId, filters);
  const [equipment, facilityRow, deptRow] = await Promise.all([
    prisma.equipment.findMany({
      where,
      include: { hospital: true, department: true },
      orderBy: { controlNum: "asc" },
      take: EQUIPMENT_PRINT_TAKE,
    }),
    filters.facilityId
      ? prisma.hospital.findFirst({
          where: { id: filters.facilityId, organizationId },
          select: { name: true },
        })
      : Promise.resolve(null),
    filters.departmentId
      ? prisma.department.findFirst({
          where: { id: filters.departmentId, organizationId },
          select: { name: true, costCtr: true },
        })
      : Promise.resolve(null),
  ]);

  const org = organizationName || "Organization";
  const statusLabel = statusLabelFor("equipment", filters.status);
  const facilityLabel = facilityRow?.name || "All facilities";
  const deptLabel = deptRow
    ? `${deptRow.name}${deptRow.costCtr ? ` (${deptRow.costCtr})` : ""}`
    : "All departments";
  const pmLabel = onPmLabel(filters.onPm);
  const searchBit = filters.q ? ` · Look-up “${filters.q}”` : "";

  const subtitle = [
    statusLabel,
    facilityLabel,
    deptLabel,
    pmLabel,
    `${equipment.length} device(s)`,
  ]
    .filter(Boolean)
    .join(" · ");

  const backHref = fromEquipment
    ? equipmentListHref(filters)
    : (() => {
        const q = new URLSearchParams();
        q.set("type", "equipment");
        q.set("status", filters.status);
        if (filters.facilityId) q.set("facility", filters.facilityId);
        return `/reports?${q.toString()}`;
      })();
  const backLabel = fromEquipment ? "Back to Equipment" : "Back to Reports";

  return (
    <div>
      <PrintToolbar backHref={backHref} backLabel={backLabel} />
      <article className="print-document">
        <PrintHeader
          organizationName={org}
          logoSrc={printLogoSrc}
          title="Equipment Inventory"
          subtitle={`${subtitle}${searchBit}`}
        />
        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{columnLabel(col)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipment.map((e) => (
                <tr key={e.id}>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className={col === "controlNum" ? "font-medium" : undefined}
                    >
                      {equipmentPrintCellValue(col, e)}
                    </td>
                  ))}
                </tr>
              ))}
              {equipment.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(columns.length, 1)}
                    className="py-6 text-center text-slate-400"
                  >
                    No equipment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {equipment.length >= EQUIPMENT_PRINT_TAKE ? (
          <p className="mt-3 text-xs text-slate-500 print:text-slate-700">
            Showing first {EQUIPMENT_PRINT_TAKE} matching devices. Narrow
            filters if you need a smaller printout.
          </p>
        ) : null}
      </article>
    </div>
  );
}

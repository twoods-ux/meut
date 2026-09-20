import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { requireOrgSession } from "@/lib/tenant";
import { resolveSearchParams, oneParam } from "@/lib/route-params";
import {
  EQUIPMENT_PAGE_SIZE,
  buildEquipmentWhere,
  equipmentListHref,
  equipmentPrintHref,
  parseEquipmentFilters,
} from "@/lib/equipment-filters";
import { equipmentColumnsFromPrefs } from "@/lib/equipment-print-columns";
import { EquipmentPrintColumns } from "@/components/equipment-print-columns";
import { Printer, Search } from "lucide-react";
import { PmDueBadge } from "@/components/pm-due-badge";

export const dynamic = "force-dynamic";

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, userId } = await requireOrgSession();
  const userPrefs = await prisma.user.findUnique({
    where: { id: userId },
    select: { printPrefs: true },
  });
  const printColumns = equipmentColumnsFromPrefs(userPrefs?.printPrefs);
  const raw = await resolveSearchParams(searchParams);
  const filters = parseEquipmentFilters({
    q: oneParam(raw.q),
    status: oneParam(raw.status),
    facility: oneParam(raw.facility),
    dept: oneParam(raw.dept),
    onPm: oneParam(raw.onPm),
    page: oneParam(raw.page),
  });

  const where = buildEquipmentWhere(organizationId, filters);

  const [facilities, allDepartments, total, equipment] = await Promise.all([
    prisma.hospital.findMany({
      where: { organizationId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, hospId: true },
    }),
    prisma.department.findMany({
      where: {
        organizationId,
        active: true,
        ...(filters.facilityId ? { hospitalId: filters.facilityId } : {}),
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        costCtr: true,
        hospitalId: true,
        hospital: { select: { name: true } },
      },
    }),
    prisma.equipment.count({ where }),
    prisma.equipment.findMany({
      where,
      include: { hospital: true, department: true },
      orderBy: { controlNum: "asc" },
      skip: (filters.page - 1) * EQUIPMENT_PAGE_SIZE,
      take: EQUIPMENT_PAGE_SIZE,
    }),
  ]);

  // If selected dept is outside scoped list (e.g. facility changed), still show it
  const deptIds = new Set(allDepartments.map((d) => d.id));
  let departments = allDepartments;
  if (filters.departmentId && !deptIds.has(filters.departmentId)) {
    const orphan = await prisma.department.findFirst({
      where: { id: filters.departmentId, organizationId },
      select: {
        id: true,
        name: true,
        costCtr: true,
        hospitalId: true,
        hospital: { select: { name: true } },
      },
    });
    if (orphan) departments = [orphan, ...allDepartments];
  }

  const totalPages = Math.max(1, Math.ceil(total / EQUIPMENT_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  // Re-fetch if page was clamped (rare: empty last page after filter change)
  const rows =
    page === filters.page
      ? equipment
      : await prisma.equipment.findMany({
          where,
          include: { hospital: true, department: true },
          orderBy: { controlNum: "asc" },
          skip: (page - 1) * EQUIPMENT_PAGE_SIZE,
          take: EQUIPMENT_PAGE_SIZE,
        });

  const showingFrom = total === 0 ? 0 : (page - 1) * EQUIPMENT_PAGE_SIZE + 1;
  const showingTo = Math.min(page * EQUIPMENT_PAGE_SIZE, total);
  const printHref = equipmentPrintHref({ ...filters, page });
  const facilityValue = filters.facilityId || "ALL";
  const deptValue = filters.departmentId || "ALL";

  return (
    <div>
      <PageHeader
        title="Equipment"
        subtitle="Inventory of biomedical / clinical devices — filter, then print what you see"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <EquipmentPrintColumns initialColumns={printColumns} />
            <a
              href={printHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <Printer className="h-4 w-4" />
              Print this list
            </a>
            <Link href="/equipment/new" className="btn-primary">
              Add Equipment
            </Link>
          </div>
        }
      />

      <form className="card mb-5 space-y-4 !p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="sm:col-span-2 xl:col-span-2">
            <label className="label" htmlFor="q">
              Look-up
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                id="q"
                name="q"
                placeholder="Control #, facility, serial, model…"
                defaultValue={filters.q}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="facility">
              Facility
            </label>
            <select
              className="input"
              id="facility"
              name="facility"
              defaultValue={facilityValue}
            >
              <option value="ALL">All facilities</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.hospId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="dept">
              Department
            </label>
            <select
              className="input"
              id="dept"
              name="dept"
              defaultValue={deptValue}
            >
              <option value="ALL">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {filters.facilityId
                    ? `${d.name} (${d.costCtr})`
                    : `${d.hospital.name} — ${d.name}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select
              className="input"
              id="status"
              name="status"
              defaultValue={filters.status}
            >
              <option value="ACTIVE">Active only</option>
              <option value="RETIRED">Retired only</option>
              <option value="ALL">All equipment</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="onPm">
              On PM
            </label>
            <select
              className="input"
              id="onPm"
              name="onPm"
              defaultValue={filters.onPm}
            >
              <option value="ALL">All</option>
              <option value="YES">Yes</option>
              <option value="NO">No</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <button type="submit" className="btn-primary">
            Find
          </button>
          <a
            href={printHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <Printer className="h-4 w-4" />
            Print this list
          </a>
          <p className="text-xs text-slate-400 sm:ml-2">
            Print opens a printable view of the current filters (full matching
            list, not only this page). Use Print columns (above) to choose fields.
          </p>
        </div>
      </form>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {total === 0 ? (
            <>No matching equipment</>
          ) : (
            <>
              Showing{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {showingFrom}–{showingTo}
              </span>{" "}
              of{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {total}
              </span>
            </>
          )}
        </p>
        {totalPages > 1 ? (
          <div className="flex items-center gap-2 text-sm">
            {page > 1 ? (
              <Link
                href={equipmentListHref({ ...filters, page: page - 1 })}
                className="btn-secondary text-xs"
              >
                ← Prev
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none text-xs opacity-40">
                ← Prev
              </span>
            )}
            <span className="tabular-nums text-slate-500">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={equipmentListHref({ ...filters, page: page + 1 })}
                className="btn-secondary text-xs"
              >
                Next →
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none text-xs opacity-40">
                Next →
              </span>
            )}
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No equipment found"
          message="Try different filters, add inventory, or run npm run import:mdb to load your Access database."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Control #</th>
                <th>Facility</th>
                <th>Description</th>
                <th>Manufacturer</th>
                <th>Model</th>
                <th>Location</th>
                <th>Dept</th>
                <th>PM</th>
                <th>Next Due</th>
                <th>Risk</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link
                      href={`/equipment/${e.id}`}
                      className="link-brand"
                    >
                      {e.controlNum}
                    </Link>
                  </td>
                  <td
                    className="max-w-[180px] truncate"
                    title={e.hospital?.name || e.hospId || undefined}
                  >
                    {e.hospital?.name || e.hospId || "—"}
                  </td>
                  <td className="max-w-[220px] truncate">
                    {e.description || "—"}
                  </td>
                  <td>{e.manufacturer || "—"}</td>
                  <td>{e.model || "—"}</td>
                  <td>{e.location || "—"}</td>
                  <td>{e.department?.name || e.costCtr || "—"}</td>
                  <td>
                    {e.onPm ? (
                      <span className="badge bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/15">
                        {e.pmSchedule1 || "Yes"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <PmDueBadge pmNextDue={e.pmNextDue} compact />
                  </td>
                  <td>{e.risk || "—"}</td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            {EQUIPMENT_PAGE_SIZE} per page
          </p>
          <div className="flex items-center gap-2 text-sm">
            {page > 1 ? (
              <Link
                href={equipmentListHref({ ...filters, page: page - 1 })}
                className="btn-secondary text-xs"
              >
                ← Prev
              </Link>
            ) : null}
            <span className="tabular-nums text-slate-500">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={equipmentListHref({ ...filters, page: page + 1 })}
                className="btn-secondary text-xs"
              >
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          {total} record(s) matching filters
        </p>
      )}
    </div>
  );
}

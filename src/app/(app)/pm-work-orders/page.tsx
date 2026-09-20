import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { generatePmWorkOrders, closeWorkOrder } from "@/lib/actions";
import { revalidatePath } from "next/cache";
import { requireOrgSession } from "@/lib/tenant";
import { resolveSearchParams, oneParam } from "@/lib/route-params";
import {
  WORK_ORDER_PAGE_SIZE,
  buildWorkOrderWhere,
  parseWorkOrderFilters,
  workOrderListHref,
  workOrderPrintHref,
} from "@/lib/work-order-filters";
import { Printer, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PmPage({
  searchParams,
}: {
  searchParams:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId } = await requireOrgSession();
  const raw = await resolveSearchParams(searchParams);
  const filters = parseWorkOrderFilters({
    q: oneParam(raw.q),
    status: oneParam(raw.status),
    facility: oneParam(raw.facility),
    from: oneParam(raw.from),
    to: oneParam(raw.to),
    tech: oneParam(raw.tech),
    pmResult: oneParam(raw.pmResult),
    pmMonth: oneParam(raw.pmMonth),
    page: oneParam(raw.page),
  });

  const where = buildWorkOrderWhere(organizationId, "PM", filters);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [facilities, techs, total, wos, onPmCount] = await Promise.all([
    prisma.hospital.findMany({
      where: { organizationId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, hospId: true },
    }),
    prisma.user.findMany({
      where: {
        organizationId,
        active: true,
        role: { in: ["TECH", "SUPERVISOR"] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, techId: true, username: true },
    }),
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      include: { equipment: true, assignedTech: true },
      orderBy: [{ pmMonth: "desc" }, { woNumber: "desc" }],
      skip: (filters.page - 1) * WORK_ORDER_PAGE_SIZE,
      take: WORK_ORDER_PAGE_SIZE,
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

  const totalPages = Math.max(1, Math.ceil(total / WORK_ORDER_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const rows =
    page === filters.page
      ? wos
      : await prisma.workOrder.findMany({
          where,
          include: { equipment: true, assignedTech: true },
          orderBy: [{ pmMonth: "desc" }, { woNumber: "desc" }],
          skip: (page - 1) * WORK_ORDER_PAGE_SIZE,
          take: WORK_ORDER_PAGE_SIZE,
        });

  const showingFrom = total === 0 ? 0 : (page - 1) * WORK_ORDER_PAGE_SIZE + 1;
  const showingTo = Math.min(page * WORK_ORDER_PAGE_SIZE, total);
  const listFilters = { ...filters, page };
  const printHref = workOrderPrintHref("PM", listFilters);
  const facilityValue = filters.facilityId || "ALL";
  const techValue = filters.techId || "ALL";
  const showClosedCols =
    filters.status === "CLOSED" || filters.status === "ALL";

  return (
    <div>
      <PageHeader
        title="PM Work Orders"
        subtitle="Generate / print and close preventive maintenance work orders"
        actions={
          <a
            href={printHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <Printer className="h-4 w-4" /> Print this list
          </a>
        }
      />

      <form
        action={generateAction}
        className="card mb-6 flex flex-wrap items-end gap-3 print:hidden"
      >
        <div>
          <label className="label">Generate for month (YYYY-MM)</label>
          <input
            className="input w-40"
            name="month"
            defaultValue={defaultMonth}
            required
            pattern="\d{4}-\d{2}"
          />
        </div>
        <button type="submit" className="btn-primary">
          Generate PM WOs
        </button>
        <p className="w-full text-xs text-slate-500">
          Creates open PM work orders for all active equipment with On PM (
          {onPmCount} devices). Skips equipment that already has a PM WO for that
          month.
        </p>
      </form>

      <form className="card mb-5 space-y-4 !p-4 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="q">
              Look-up
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                id="q"
                name="q"
                placeholder="WO #, control #, description…"
                defaultValue={filters.q}
              />
            </div>
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
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="ALL">All</option>
            </select>
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
            <label className="label" htmlFor="tech">
              Assigned tech
            </label>
            <select
              className="input"
              id="tech"
              name="tech"
              defaultValue={techValue}
            >
              <option value="ALL">All technicians</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.techId ? ` (${t.techId})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="from">
              Opened from
            </label>
            <input
              className="input"
              id="from"
              name="from"
              type="date"
              defaultValue={filters.from || ""}
            />
          </div>

          <div>
            <label className="label" htmlFor="to">
              Opened to
            </label>
            <input
              className="input"
              id="to"
              name="to"
              type="date"
              defaultValue={filters.to || ""}
            />
          </div>

          <div>
            <label className="label" htmlFor="pmMonth">
              PM month
            </label>
            <input
              className="input"
              id="pmMonth"
              name="pmMonth"
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              defaultValue={filters.pmMonth || ""}
            />
          </div>

          <div>
            <label className="label" htmlFor="pmResult">
              Pass / Fail
            </label>
            <select
              className="input"
              id="pmResult"
              name="pmResult"
              defaultValue={filters.pmResult}
            >
              <option value="ALL">All results</option>
              <option value="PASS">Pass</option>
              <option value="FAIL">Fail</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Applies when status is Closed or All
            </p>
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
            <Printer className="h-4 w-4" /> Print this list
          </a>
          <Link href="/pm-work-orders" className="btn-ghost text-xs">
            Clear filters
          </Link>
          <p className="text-xs text-slate-400 sm:ml-2">
            Print opens a printable view of the current filters (full matching
            list, not only this page).
          </p>
        </div>
      </form>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {total === 0 ? (
            <>No matching PM work orders</>
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
                href={workOrderListHref("PM", listFilters, page - 1)}
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
                href={workOrderListHref("PM", listFilters, page + 1)}
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
        <EmptyState message="No PM work orders match these filters. Generate for a month above if needed." />
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
                {showClosedCols ? <th>Result</th> : null}
                {showClosedCols ? <th>Date closed</th> : null}
                <th>Tech</th>
                <th>Opened</th>
                <th className="print:hidden">Print</th>
                <th className="print:hidden">Close</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((wo) => (
                <tr key={wo.id}>
                  <td className="font-medium">{wo.woNumber}</td>
                  <td>{wo.pmMonth || "—"}</td>
                  <td>
                    <Link
                      href={`/equipment/${wo.equipmentId}`}
                      className="link-brand"
                    >
                      {wo.controlNum || wo.equipment.controlNum}
                    </Link>
                  </td>
                  <td>{wo.pmSchedule1 || wo.equipment.pmSchedule1 || "—"}</td>
                  <td>
                    <StatusBadge status={wo.status} />
                  </td>
                  {showClosedCols ? (
                    <td>
                      {wo.pmResult ? (
                        <StatusBadge status={wo.pmResult} />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  ) : null}
                  {showClosedCols ? (
                    <td>{wo.dateClosed ? formatDate(wo.dateClosed) : "—"}</td>
                  ) : null}
                  <td>
                    {wo.assignedTech?.name || wo.assignedTechCode || "—"}
                  </td>
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
                      <form
                        action={closeAction}
                        className="flex flex-wrap items-center gap-1"
                      >
                        <input type="hidden" name="id" value={wo.id} />
                        <input
                          type="hidden"
                          name="workPerformed"
                          value="PM completed per procedure"
                        />
                        <select
                          className="input w-[5.5rem] py-1 text-xs"
                          name="pmResult"
                          required
                          defaultValue=""
                          title="Pass or Fail"
                        >
                          <option value="" disabled>
                            Result
                          </option>
                          <option value="PASS">Pass</option>
                          <option value="FAIL">Fail</option>
                        </select>
                        <input
                          className="input w-16 py-1"
                          name="laborHours"
                          type="number"
                          step="0.25"
                          defaultValue="0.5"
                          title="Labor hours"
                        />
                        <button
                          type="submit"
                          className="btn-secondary text-xs py-1"
                        >
                          Close
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {wo.laborHours ?? "—"}h
                      </span>
                    )}
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
            {WORK_ORDER_PAGE_SIZE} per page
          </p>
          <div className="flex items-center gap-2 text-sm">
            {page > 1 ? (
              <Link
                href={workOrderListHref("PM", listFilters, page - 1)}
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
                href={workOrderListHref("PM", listFilters, page + 1)}
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

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { requireOrgSession } from "@/lib/tenant";
import { resolveSearchParams, oneParam } from "@/lib/route-params";
import {
  WORK_ORDER_PAGE_SIZE,
  buildWorkOrderWhere,
  parseWorkOrderFilters,
  workOrderListHref,
  workOrderPrintHref,
} from "@/lib/work-order-filters";
import { FilePlus, Printer, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CmListPage({
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
    page: oneParam(raw.page),
  });

  const where = buildWorkOrderWhere(organizationId, "CM", filters);

  const [facilities, techs, total, wos] = await Promise.all([
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
      orderBy: { dateOpened: "desc" },
      skip: (filters.page - 1) * WORK_ORDER_PAGE_SIZE,
      take: WORK_ORDER_PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / WORK_ORDER_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const rows =
    page === filters.page
      ? wos
      : await prisma.workOrder.findMany({
          where,
          include: { equipment: true, assignedTech: true },
          orderBy: { dateOpened: "desc" },
          skip: (page - 1) * WORK_ORDER_PAGE_SIZE,
          take: WORK_ORDER_PAGE_SIZE,
        });

  const showingFrom = total === 0 ? 0 : (page - 1) * WORK_ORDER_PAGE_SIZE + 1;
  const showingTo = Math.min(page * WORK_ORDER_PAGE_SIZE, total);
  const listFilters = { ...filters, page };
  const printHref = workOrderPrintHref("CM", listFilters);
  const facilityValue = filters.facilityId || "ALL";
  const techValue = filters.techId || "ALL";

  return (
    <div>
      <PageHeader
        title="CM Work Orders"
        subtitle="Corrective maintenance — filter, review, and close"
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href={printHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <Printer className="h-4 w-4" /> Print this list
            </a>
            <Link href="/cm-work-orders/blank/print" className="btn-secondary">
              <FilePlus className="h-4 w-4" /> Blank form
            </Link>
            <Link href="/cm-work-orders/new" className="btn-primary">
              Open CM
            </Link>
          </div>
        }
      />

      <form className="card mb-5 space-y-4 !p-4 print:hidden">
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
                placeholder="WO #, control #, problem text…"
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
          <Link href="/cm-work-orders" className="btn-ghost text-xs">
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
            <>No matching CM work orders</>
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
                href={workOrderListHref("CM", listFilters, page - 1)}
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
                href={workOrderListHref("CM", listFilters, page + 1)}
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
        <EmptyState message="No CM work orders match these filters." />
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
              {rows.map((wo) => (
                <tr key={wo.id}>
                  <td>
                    <Link
                      href={`/cm-work-orders/${wo.id}`}
                      className="link-brand"
                    >
                      {wo.woNumber}
                    </Link>
                  </td>
                  <td>{wo.controlNum || wo.equipment.controlNum}</td>
                  <td>{wo.priority || "—"}</td>
                  <td>
                    <StatusBadge status={wo.status} />
                  </td>
                  <td>{formatDate(wo.dateOpened)}</td>
                  <td>
                    {wo.assignedTech?.name || wo.assignedTechCode || "—"}
                  </td>
                  <td className="max-w-md truncate">
                    {wo.workRequested || "—"}
                  </td>
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

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            {WORK_ORDER_PAGE_SIZE} per page
          </p>
          <div className="flex items-center gap-2 text-sm">
            {page > 1 ? (
              <Link
                href={workOrderListHref("CM", listFilters, page - 1)}
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
                href={workOrderListHref("CM", listFilters, page + 1)}
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

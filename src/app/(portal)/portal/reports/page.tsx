import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import {
  requireCustomerSession,
  resolveCustomerFacility,
  customerFacilityEquipmentWhere,
} from "@/lib/tenant";
import { PrintButton } from "@/components/print-button";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function CustomerReportsPage({
  searchParams,
}: {
  searchParams: { type?: string; from?: string; to?: string };
}) {
  const { organizationId, hospitalId, organizationName } =
    await requireCustomerSession();
  const typeFilter = searchParams.type || "ALL";
  const from = searchParams.from?.trim() || "";
  const to = searchParams.to?.trim() || "";

  const facility = await resolveCustomerFacility(organizationId, hospitalId);

  const where: Prisma.WorkOrderWhereInput = {
    organizationId,
    status: "CLOSED",
    equipment: facility
      ? customerFacilityEquipmentWhere(organizationId, facility)
      : { hospitalId },
  };
  if (typeFilter === "CM" || typeFilter === "PM") {
    where.type = typeFilter;
  }

  if (from || to) {
    const dateClosed: Prisma.DateTimeFilter = {};
    if (from) {
      const start = new Date(from);
      if (!Number.isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
        dateClosed.gte = start;
      }
    }
    if (to) {
      const end = new Date(to);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        dateClosed.lte = end;
      }
    }
    if (Object.keys(dateClosed).length > 0) {
      where.dateClosed = dateClosed;
    }
  }

  const wos = await prisma.workOrder.findMany({
    where,
    include: { equipment: true, assignedTech: true, closedBy: true },
    orderBy: { dateClosed: "desc" },
    take: 500,
  });

  const printQs = new URLSearchParams();
  if (typeFilter !== "ALL") printQs.set("type", typeFilter);
  if (from) printQs.set("from", from);
  if (to) printQs.set("to", to);
  const printHref = `/portal/reports/print${printQs.toString() ? `?${printQs}` : ""}`;

  function chip(href: string, label: string, active: boolean) {
    return (
      <Link
        href={href}
        className={`btn-secondary text-xs print:hidden ${active ? "ring-2 ring-sky-400" : ""}`}
      >
        {label}
      </Link>
    );
  }

  const base = "/portal/reports";
  const dateQs = [
    from ? `from=${encodeURIComponent(from)}` : "",
    to ? `to=${encodeURIComponent(to)}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const dateSuffix = dateQs ? `&${dateQs}` : "";

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Completed reports"
          subtitle={`Closed CM and PM work orders for ${facility?.name || "your facility"}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href={printHref} className="btn-secondary">
                Print view
              </Link>
              <PrintButton label="Print" />
            </div>
          }
        />
      </div>

      <div className="mb-2 hidden print:block">
        <h1 className="text-xl font-bold text-slate-900">
          Completed reports — {facility?.name || organizationName || "Facility"}
        </h1>
        <p className="text-sm text-slate-600">
          {typeFilter === "ALL" ? "CM + PM" : typeFilter}
          {from || to ? ` · ${from || "…"} → ${to || "…"}` : ""} · {wos.length}{" "}
          record(s)
        </p>
      </div>

      <form
        method="get"
        className="card mb-4 flex flex-wrap items-end gap-3 !p-4 print:hidden"
      >
        <div className="w-full sm:w-40">
          <label className="label" htmlFor="type">
            Type
          </label>
          <select
            className="input"
            id="type"
            name="type"
            defaultValue={typeFilter}
          >
            <option value="ALL">CM + PM</option>
            <option value="CM">CM only</option>
            <option value="PM">PM only</option>
          </select>
        </div>
        <div className="w-full sm:w-44">
          <label className="label" htmlFor="from">
            Closed from
          </label>
          <input
            className="input"
            type="date"
            id="from"
            name="from"
            defaultValue={from}
          />
        </div>
        <div className="w-full sm:w-44">
          <label className="label" htmlFor="to">
            Closed to
          </label>
          <input
            className="input"
            type="date"
            id="to"
            name="to"
            defaultValue={to}
          />
        </div>
        <button type="submit" className="btn-primary">
          Apply
        </button>
        {(from || to || typeFilter !== "ALL") && (
          <Link href={base} className="btn-secondary">
            Clear
          </Link>
        )}
      </form>

      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {chip(`${base}?type=ALL${dateSuffix}`, "CM + PM", typeFilter === "ALL")}
        {chip(`${base}?type=CM${dateSuffix}`, "CM only", typeFilter === "CM")}
        {chip(`${base}?type=PM${dateSuffix}`, "PM only", typeFilter === "PM")}
      </div>

      {wos.length === 0 ? (
        <EmptyState message="No completed CM or PM reports for your facility in this range." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>WO</th>
                <th>Type</th>
                <th>Control #</th>
                <th>Closed</th>
                <th>Tech</th>
                <th>Work requested</th>
                <th>Work performed</th>
                <th className="print:hidden"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wos.map((wo) => (
                <tr key={wo.id}>
                  <td>
                    <Link
                      href={`/portal/work-orders/${wo.id}`}
                      className="link-brand print:text-slate-900 print:no-underline"
                    >
                      {wo.woNumber}
                    </Link>
                  </td>
                  <td>
                    <span className="badge bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/15">
                      {wo.type}
                    </span>
                  </td>
                  <td>{wo.controlNum || wo.equipment.controlNum}</td>
                  <td>{formatDate(wo.dateClosed)}</td>
                  <td>
                    {wo.closedBy?.name ||
                      wo.assignedTech?.name ||
                      wo.assignedTechCode ||
                      "—"}
                  </td>
                  <td className="max-w-xs truncate">
                    {wo.workRequested || "—"}
                  </td>
                  <td className="max-w-xs truncate">
                    {wo.workPerformed || "—"}
                  </td>
                  <td className="print:hidden">
                    <StatusBadge status={wo.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400 print:hidden">
        Showing {wos.length} completed report(s)
      </p>
    </div>
  );
}

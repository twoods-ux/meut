import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import {
  requireCustomerSession,
  resolveCustomerFacility,
  customerFacilityEquipmentWhere,
} from "@/lib/tenant";
import { Search } from "lucide-react";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function CustomerInventoryPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const { organizationId, hospitalId } = await requireCustomerSession();
  const q = searchParams.q?.trim() || "";
  const statusFilter = searchParams.status || "ACTIVE";

  const facility = await resolveCustomerFacility(organizationId, hospitalId);

  const extra: Prisma.EquipmentWhereInput = {};
  if (statusFilter === "ACTIVE") extra.status = "ACTIVE";
  else if (statusFilter === "RETIRED") extra.status = "RETIRED";
  if (q) {
    extra.OR = [
      { controlNum: { contains: q } },
      { serial: { contains: q } },
      { manufacturer: { contains: q } },
      { model: { contains: q } },
      { description: { contains: q } },
      { location: { contains: q } },
    ];
  }

  const equipment = facility
    ? await prisma.equipment.findMany({
        where: customerFacilityEquipmentWhere(organizationId, facility, extra),
        include: { department: true },
        orderBy: { controlNum: "asc" },
        take: 500,
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle={`Facility: ${facility?.name || "your facility"} · view by Control #`}
      />
      <form className="card mb-5 flex flex-wrap items-end gap-3 !p-4">
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="q">
            Look-up
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              id="q"
              name="q"
              placeholder="Control #, serial, model…"
              defaultValue={q}
            />
          </div>
        </div>
        <div className="w-full sm:w-44">
          <label className="label" htmlFor="status">
            Status
          </label>
          <select
            className="input"
            id="status"
            name="status"
            defaultValue={statusFilter}
          >
            <option value="ACTIVE">Active only</option>
            <option value="RETIRED">Retired only</option>
            <option value="ALL">All equipment</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Find
        </button>
      </form>
      {equipment.length === 0 ? (
        <EmptyState
          title="No equipment found"
          message="No inventory is linked to your facility yet."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Control #</th>
                <th>Description</th>
                <th>Manufacturer</th>
                <th>Model</th>
                <th>Location</th>
                <th>Dept</th>
                <th>PM</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link
                      href={`/portal/inventory/${e.id}`}
                      className="link-brand"
                    >
                      {e.controlNum}
                    </Link>
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
                    <StatusBadge status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Showing {equipment.length} record(s) (max 500) · read-only
      </p>
    </div>
  );
}

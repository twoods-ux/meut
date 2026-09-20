import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { createContract } from "@/lib/actions";
import { formatDate } from "@/lib/utils";
import { requireOrgSession } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const { organizationId } = await requireOrgSession();
  const now = new Date();
  const [contracts, warranties, hospitals] = await Promise.all([
    prisma.serviceContract.findMany({
      where: { organizationId },
      include: { hospital: true },
      orderBy: { expirationDate: "asc" },
    }),
    prisma.equipment.findMany({
      where: {
        organizationId,
        OR: [
          { warrantyPartsEnd: { not: null } },
          { warrantyLaborEnd: { not: null } },
        ],
      },
      include: { hospital: true },
      orderBy: { warrantyPartsEnd: "asc" },
      take: 100,
    }),
    prisma.hospital.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
  ]);

  async function addContract(formData: FormData) {
    "use server";
    await createContract(formData);
  }

  return (
    <div>
      <PageHeader
        title="Contracts / Warranties"
        subtitle="Service contracts and warranty expirations"
      />

      <form action={addContract} className="card mb-8 grid gap-3 md:grid-cols-3">
        <h2 className="md:col-span-3 font-semibold">Add Service Contract</h2>
        <div>
          <label className="label">Contract # *</label>
          <input className="input" name="contractNum" required />
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input" name="name" />
        </div>
        <div>
          <label className="label">Vendor</label>
          <input className="input" name="vendorName" />
        </div>
        <div>
          <label className="label">Hospital</label>
          <select className="input" name="hospitalId">
            <option value="">—</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Expiration</label>
          <input className="input" name="expirationDate" type="date" />
        </div>
        <div>
          <label className="label">Annual Cost</label>
          <input className="input" name="contractCost" type="number" step="0.01" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Coverage Summary</label>
          <input className="input" name="coverageSummary" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>

      <h2 className="mb-3 text-lg font-semibold">Service Contracts</h2>
      <div className="table-wrap mb-10">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contract #</th>
              <th>Name</th>
              <th>Vendor</th>
              <th>Hospital</th>
              <th>Expires</th>
              <th>Cost</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contracts.map((c) => {
              const expired = c.expirationDate && c.expirationDate < now;
              const soon =
                c.expirationDate &&
                c.expirationDate >= now &&
                c.expirationDate.getTime() - now.getTime() < 90 * 86400000;
              return (
                <tr key={c.id} className={expired ? "bg-rose-50/50" : soon ? "bg-amber-50/40" : ""}>
                  <td className="font-medium">{c.contractNum}</td>
                  <td>{c.name || "—"}</td>
                  <td>{c.vendorName || "—"}</td>
                  <td>{c.hospital?.name || c.hospId || "—"}</td>
                  <td>{formatDate(c.expirationDate)}</td>
                  <td>{c.contractCost != null ? `$${c.contractCost.toLocaleString()}` : "—"}</td>
                  <td>
                    <StatusBadge status={!c.active || expired ? "EXPIRED" : soon ? "SOON" : "ACTIVE"} />
                  </td>
                </tr>
              );
            })}
            {contracts.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400">No contracts</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Warranty Expirations</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Control #</th>
              <th>Description</th>
              <th>Hospital</th>
              <th>Parts Warranty End</th>
              <th>Labor Warranty End</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {warranties.map((e) => (
              <tr key={e.id}>
                <td className="font-medium">{e.controlNum}</td>
                <td>{e.description || e.model || "—"}</td>
                <td>{e.hospital?.name || e.hospId || "—"}</td>
                <td>{formatDate(e.warrantyPartsEnd)}</td>
                <td>{formatDate(e.warrantyLaborEnd)}</td>
              </tr>
            ))}
            {warranties.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-slate-400">No warranty dates on file</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

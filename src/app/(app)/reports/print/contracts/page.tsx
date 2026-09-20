import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/tenant";
import { PrintHeader, PrintToolbar } from "@/components/print-header";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContractsWarrantyPrintPage() {
  const { organizationId, organizationName } = await requireOrgSession();
  const orgBrand = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { logoDataUrl: true },
  });
  const printLogoSrc = orgBrand?.logoDataUrl ? "/api/org/logo" : null;
  const now = new Date();

  const [contracts, warranties] = await Promise.all([
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
      take: 500,
    }),
  ]);

  const org = organizationName || "Organization";

  return (
    <div>
      <PrintToolbar backHref="/reports" backLabel="Back to Reports" />
      <article className="print-document">
        <PrintHeader
          organizationName={org}
          logoSrc={printLogoSrc}
          title="Contracts & Warranty Expirations"
          subtitle={`${contracts.length} contract(s) · ${warranties.length} warranty record(s)`}
        />

        <h2 className="print-section-title">Service contracts</h2>
        <div className="overflow-x-auto">
          <table className="data-table text-xs">
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
                const label = !c.active || expired ? "EXPIRED" : soon ? "SOON" : "ACTIVE";
                return (
                  <tr key={c.id}>
                    <td className="font-medium">{c.contractNum}</td>
                    <td>{c.name || "—"}</td>
                    <td>{c.vendorName || "—"}</td>
                    <td>{c.hospital?.name || c.hospId || "—"}</td>
                    <td>{formatDate(c.expirationDate)}</td>
                    <td>
                      {c.contractCost != null
                        ? `$${c.contractCost.toLocaleString()}`
                        : "—"}
                    </td>
                    <td>{label}</td>
                  </tr>
                );
              })}
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No contracts
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h2 className="print-section-title">Warranty expirations</h2>
        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>Control #</th>
                <th>Description</th>
                <th>Hospital</th>
                <th>Parts warranty end</th>
                <th>Labor warranty end</th>
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
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No warranty dates on file
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

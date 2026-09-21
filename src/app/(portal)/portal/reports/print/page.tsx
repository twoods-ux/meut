import { prisma } from "@/lib/prisma";
import { requireCustomerSession } from "@/lib/tenant";
import { PrintHeader, PrintToolbar } from "@/components/print-header";
import { formatDate } from "@/lib/utils";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function CustomerReportsPrintPage({
  searchParams,
}: {
  searchParams: { type?: string; from?: string; to?: string };
}) {
  const { organizationId, hospitalId, organizationName } =
    await requireCustomerSession();
  const typeFilter = searchParams.type || "ALL";
  const from = searchParams.from?.trim() || "";
  const to = searchParams.to?.trim() || "";

  const [hospital, orgBrand] = await Promise.all([
    prisma.hospital.findFirst({
      where: { id: hospitalId, organizationId },
      select: { name: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logoDataUrl: true },
    }),
  ]);

  const where: Prisma.WorkOrderWhereInput = {
    organizationId,
    status: "CLOSED",
    equipment: { hospitalId },
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

  const typeLabel =
    typeFilter === "CM" ? "CM" : typeFilter === "PM" ? "PM" : "CM + PM";
  const datePart =
    from || to ? ` · ${from || "…"} → ${to || "…"}` : "";
  const backQs = new URLSearchParams();
  if (typeFilter !== "ALL") backQs.set("type", typeFilter);
  if (from) backQs.set("from", from);
  if (to) backQs.set("to", to);
  const backHref = `/portal/reports${backQs.toString() ? `?${backQs}` : ""}`;

  const printLogoSrc = orgBrand?.logoDataUrl ? "/api/org/logo" : null;
  const org = organizationName || "Organization";

  return (
    <div>
      <PrintToolbar backHref={backHref} backLabel="Back to reports" />
      <article className="print-document">
        <PrintHeader
          organizationName={org}
          logoSrc={printLogoSrc}
          title="Completed CM / PM Reports"
          subtitle={`${typeLabel} · ${hospital?.name || "Facility"}${datePart} · ${wos.length} record(s)`}
        />
        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>WO</th>
                <th>Type</th>
                <th>Control #</th>
                <th>Closed</th>
                <th>Tech</th>
                <th>Work requested</th>
                <th>Work performed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wos.map((wo) => (
                <tr key={wo.id}>
                  <td className="font-medium">{wo.woNumber}</td>
                  <td>{wo.type}</td>
                  <td>{wo.controlNum || wo.equipment.controlNum}</td>
                  <td>{formatDate(wo.dateClosed)}</td>
                  <td>
                    {wo.closedBy?.name ||
                      wo.assignedTech?.name ||
                      wo.assignedTechCode ||
                      "—"}
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap">
                    {wo.workRequested || "—"}
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap">
                    {wo.workPerformed || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {wos.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No completed reports.</p>
        ) : null}
      </article>
    </div>
  );
}

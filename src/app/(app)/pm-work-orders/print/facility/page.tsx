import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/tenant";
import { PrintToolbar } from "@/components/print-header";
import { loadMatchTemplates } from "@/lib/pm-procedure-store";
import { checklistForWorkOrder } from "@/lib/pm-procedures";
import { resolveSearchParams, oneParam } from "@/lib/route-params";
import { WORK_ORDER_REOPEN_EVENT } from "@/lib/work-order-reopen";
import { PmFacilityCompactPacket } from "@/components/pm-facility-compact-fit";
import { PmFacilityCompactSheet } from "@/components/pm-facility-compact-print";
import {
  FACILITY_PM_DETAIL_PRINT_LIMIT,
  facilityPmDetailPrintWhere,
  parseFacilityPmDetailPrintQuery,
  type FacilityPmDetailPrintQuery,
} from "@/lib/pm-facility-print";

export const dynamic = "force-dynamic";

function PrintNotice({ message }: { message: string }) {
  return (
    <div>
      <PrintToolbar backHref="/pm-work-orders" backLabel="Back to PM list" />
      <p className="text-sm text-slate-700">{message}</p>
    </div>
  );
}

function rangeLabel(query: FacilityPmDetailPrintQuery): string {
  const parts: string[] = [];
  if (query.pmMonth) parts.push(`PM month ${query.pmMonth}`);
  if (query.from && query.to) {
    parts.push(`opened ${query.from} to ${query.to}`);
  } else if (query.from) {
    parts.push(`opened from ${query.from}`);
  } else if (query.to) {
    parts.push(`opened through ${query.to}`);
  }
  parts.push(query.status === "completed" ? "completed" : "all statuses");
  return parts.join(" · ");
}

export default async function FacilityPmDetailPrintPage({
  searchParams,
}: {
  searchParams:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, organizationName } = await requireStaffSession();
  const raw = await resolveSearchParams(searchParams);
  const parsed = parseFacilityPmDetailPrintQuery({
    facility: oneParam(raw.facility),
    month: oneParam(raw.month),
    from: oneParam(raw.from),
    to: oneParam(raw.to),
    status: oneParam(raw.status),
  });
  if (!parsed.ok) return <PrintNotice message={parsed.error} />;

  const facility = await prisma.hospital.findFirst({
    where: { id: parsed.query.facilityId, organizationId },
    select: { id: true, hospId: true, name: true },
  });
  if (!facility) return <PrintNotice message="Facility not found." />;

  const where = facilityPmDetailPrintWhere(
    organizationId,
    facility,
    parsed.query
  );
  const total = await prisma.workOrder.count({ where });
  const truncated = total > FACILITY_PM_DETAIL_PRINT_LIMIT;
  const workOrders = await prisma.workOrder.findMany({
    where,
    include: {
      equipment: { include: { hospital: true, department: true } },
      assignedTech: true,
      openedBy: true,
      closedBy: true,
      events: {
        where: { type: WORK_ORDER_REOPEN_EVENT, organizationId },
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true } } },
      },
    },
    orderBy: [{ equipment: { controlNum: "asc" } }, { woNumber: "asc" }],
    take: FACILITY_PM_DETAIL_PRINT_LIMIT,
  });

  const orgBrand = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { logoDataUrl: true },
  });
  const printLogoSrc = orgBrand?.logoDataUrl ? "/api/org/logo" : null;
  const templates =
    workOrders.length > 0
      ? await loadMatchTemplates(prisma, organizationId)
      : [];
  const org = organizationName || "Organization";
  const shown = workOrders.length;

  return (
    <div>
      <PrintToolbar backHref="/pm-work-orders" backLabel="Back to PM list" />
      <div className="mb-4 print:hidden">
        <h1 className="text-lg font-semibold text-slate-900">
          {facility.name} PM reports
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {rangeLabel(parsed.query)}. {shown} of {total} work order
          {total === 1 ? "" : "s"}.
          {truncated
            ? ` This packet stops at ${FACILITY_PM_DETAIL_PRINT_LIMIT}. Narrow the month or dates to print the rest.`
            : ""}
        </p>
      </div>
      {truncated ? (
        <p className="mb-4 text-xs text-slate-600 print:hidden">
          First {FACILITY_PM_DETAIL_PRINT_LIMIT} of {total} PM reports for{" "}
          {facility.name}. Narrow the month or dates to print the rest.
        </p>
      ) : null}
      {shown === 0 ? (
        <p className="text-sm text-slate-700">
          No PM work orders for {facility.name} match {rangeLabel(parsed.query)}.
        </p>
      ) : (
        <PmFacilityCompactPacket>
          {workOrders.map((wo) => {
            const checklistView = checklistForWorkOrder({
              status: wo.status,
              pmChecklist: wo.pmChecklist,
              pmProc1: wo.pmProc1,
              equipmentPmProc1: wo.equipment.pmProc1,
              description: wo.equipment.description,
              manufacturer: wo.equipment.manufacturer,
              model: wo.equipment.model,
              pmTemplateId: wo.equipment.pmTemplateId,
              templates,
            });
            return (
              <PmFacilityCompactSheet
                key={wo.id}
                organizationName={org}
                logoSrc={printLogoSrc}
                wo={wo}
                checklistItems={checklistView.items}
              />
            );
          })}
        </PmFacilityCompactPacket>
      )}
    </div>
  );
}

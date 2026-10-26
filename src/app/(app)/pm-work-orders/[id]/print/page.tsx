import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/tenant";
import { PrintToolbar } from "@/components/print-header";
import { loadMatchTemplates } from "@/lib/pm-procedure-store";
import { checklistForWorkOrder } from "@/lib/pm-procedures";
import { resolveRouteParams } from "@/lib/route-params";
import { WORK_ORDER_REOPEN_EVENT } from "@/lib/work-order-reopen";
import { PmWorkOrderPrintDocument } from "@/components/pm-work-order-print";

export const dynamic = "force-dynamic";

export default async function PmWorkOrderPrintPage({
  params,
}: {
  params: { id: string };
}) {
  const { id: routeId } = await resolveRouteParams(params);
  const { organizationId, organizationName } = await requireOrgSession();
  const orgBrand = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { logoDataUrl: true },
  });
  const printLogoSrc = orgBrand?.logoDataUrl ? "/api/org/logo" : null;
  const wo = await prisma.workOrder.findFirst({
    where: { id: routeId, organizationId, type: "PM" },
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
  });
  if (!wo) notFound();

  const templates = await loadMatchTemplates(prisma, organizationId);
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

  const org = organizationName || "Organization";

  return (
    <div>
      <PrintToolbar
        backHref="/pm-work-orders"
        backLabel="Back to PM list"
      />
      <PmWorkOrderPrintDocument
        organizationName={org}
        logoSrc={printLogoSrc}
        wo={wo}
        checklistItems={checklistView.items}
      />
    </div>
  );
}

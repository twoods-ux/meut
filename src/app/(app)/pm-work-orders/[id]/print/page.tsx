import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/tenant";
import {
  PrintHeader,
  PrintToolbar,
  PrintField,
  PrintBlock,
} from "@/components/print-header";
import { formatDate, formatDateTime } from "@/lib/utils";
import { resolveRouteParams } from "@/lib/route-params";

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
    },
  });
  if (!wo) notFound();

  const org = organizationName || "Organization";

  return (
    <div>
      <PrintToolbar
        backHref="/pm-work-orders"
        backLabel="Back to PM list"
      />
      <article className="print-document">
        <PrintHeader
          organizationName={org}
          logoSrc={printLogoSrc}
          title={`PM Work Order #${wo.woNumber}`}
          subtitle="Preventive Maintenance"
        />

        <div className="print-grid-3">
          <PrintField label="WO #" value={wo.woNumber} />
          <PrintField label="Status" value={wo.status} />
          <PrintField label="PM month" value={wo.pmMonth} />
        </div>

        <h2 className="print-section-title">Equipment</h2>
        <div className="print-grid-3">
          <PrintField
            label="Control #"
            value={wo.controlNum || wo.equipment.controlNum}
          />
          <PrintField
            label="Description"
            value={wo.equipment.description || wo.equipment.model}
          />
          <PrintField label="Serial" value={wo.equipment.serial} />
          <PrintField label="Manufacturer" value={wo.equipment.manufacturer} />
          <PrintField label="Model" value={wo.equipment.model} />
          <PrintField label="Location" value={wo.equipment.location} />
          <PrintField label="Facility" value={wo.equipment.hospital?.name} />
          <PrintField label="Department" value={wo.equipment.department?.name} />
          <PrintField
            label="PM schedule"
            value={wo.pmSchedule1 || wo.equipment.pmSchedule1}
          />
          <PrintField
            label="PM procedure"
            value={wo.pmProc1 || wo.equipment.pmProc1}
          />
        </div>

        <h2 className="print-section-title">Work Order</h2>
        <div className="print-grid-3">
          <PrintField label="Opened" value={formatDateTime(wo.dateOpened)} />
          <PrintField
            label="Assigned tech"
            value={wo.assignedTech?.name || wo.assignedTechCode}
          />
          <PrintField label="Closed" value={formatDateTime(wo.dateClosed)} />
          <PrintField label="Closed by" value={wo.closedBy?.name} />
          <PrintField
            label="Labor hours"
            value={wo.laborHours != null ? wo.laborHours : null}
          />
        </div>

        <PrintBlock label="Work requested" value={wo.workRequested} />
        <PrintBlock label="Work performed" value={wo.workPerformed} />
        <PrintBlock label="Comments / checklist notes" value={wo.comments} blankLines={3} />

        <div className="print-sign-line">
          <div className="line">Technician signature / date</div>
          <div className="line">Supervisor signature / date</div>
        </div>

        <p className="mt-6 text-[10px] text-slate-400 print:mt-4">
          Generated {formatDate(new Date())} · M.E.U.T. PM Work Order
        </p>
      </article>
    </div>
  );
}

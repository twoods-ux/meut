import {
  PrintHeader,
  PrintField,
  PrintBlock,
} from "@/components/print-header";
import { formatDate, formatDateTime } from "@/lib/utils";
import { PmChecklistPrint } from "@/components/pm-checklist";
import type { PmChecklistItem } from "@/lib/pm";
import {
  WorkOrderReopenHistoryPrint,
  reopenHistoryFromEvents,
} from "@/components/work-order-reopen";
import { PrintSignFill } from "@/components/print-signature";
import { closeTechnicianSignature } from "@/lib/print-signature";

/** Fields the single PM print report shows. Callers load them for one work order. */
export type PmWorkOrderPrintModel = {
  woNumber: number;
  status: string;
  pmMonth: string | null;
  pmResult: string | null;
  dateClosed: Date | null;
  dateOpened: Date;
  controlNum: string | null;
  pmSchedule1: string | null;
  assignedTechCode: string | null;
  laborHours: number | null;
  workRequested: string | null;
  workPerformed: string | null;
  comments: string | null;
  pmTemplateName: string | null;
  pmTemplateVersion: number | null;
  assignedTech: {
    name: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  closedBy: {
    name: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  equipment: {
    controlNum: string;
    description: string | null;
    model: string | null;
    serial: string | null;
    manufacturer: string | null;
    location: string | null;
    pmSchedule1: string | null;
    pmNextDue: Date | null;
    hospital: { name: string } | null;
    department: { name: string } | null;
  };
  events: {
    id: string;
    createdAt: Date;
    reason: string;
    actor: { name: string } | null;
  }[];
};

/**
 * The per-work-order PM report: logo, MEUT watermark, steps, readings, and
 * reopen history. `pageBreakAfter` is for a packet of several reports.
 */
export function PmWorkOrderPrintDocument({
  organizationName,
  logoSrc,
  wo,
  checklistItems,
  pageBreakAfter = false,
}: {
  organizationName: string;
  logoSrc: string | null;
  wo: PmWorkOrderPrintModel;
  checklistItems: PmChecklistItem[];
  pageBreakAfter?: boolean;
}) {
  const procedureCaption = wo.pmTemplateName
    ? `${wo.pmTemplateName}${wo.pmTemplateVersion != null ? ` v${wo.pmTemplateVersion}` : ""}`
    : null;

  return (
    <article
      className={
        pageBreakAfter
          ? "print-document print-break-after mb-6 print:mb-0"
          : "print-document"
      }
    >
      <PrintHeader
        organizationName={organizationName}
        logoSrc={logoSrc}
        title={`PM Work Order #${wo.woNumber}`}
        subtitle="Preventive Maintenance"
      />

      <div className="print-grid-3">
        <PrintField label="WO #" value={wo.woNumber} />
        <PrintField label="Status" value={wo.status} />
        <PrintField label="PM month" value={wo.pmMonth} />
        <PrintField
          label="Result"
          value={
            wo.pmResult === "PASS"
              ? "Pass"
              : wo.pmResult === "FAIL"
                ? "Fail"
                : wo.status === "CLOSED"
                  ? "—"
                  : null
          }
        />
        <PrintField label="Date closed" value={formatDate(wo.dateClosed)} />
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
          label="Next due"
          value={formatDate(wo.equipment.pmNextDue)}
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

      {checklistItems.length > 0 ? (
        <>
          <h2 className="print-section-title">PM steps</h2>
          {procedureCaption ? (
            <p className="mb-1 text-xs text-slate-500">{procedureCaption}</p>
          ) : null}
          <PmChecklistPrint items={checklistItems} />
        </>
      ) : null}

      <PrintBlock label="Comments" value={wo.comments} blankLines={3} />

      <WorkOrderReopenHistoryPrint events={reopenHistoryFromEvents(wo.events)} />

      <div className="print-sign-line">
        <div className="line">
          <PrintSignFill
            signature={closeTechnicianSignature({
              status: wo.status,
              type: "PM",
              dateClosed: wo.dateClosed,
              assignedTech: wo.assignedTech,
              closedBy: wo.closedBy,
            })}
          />
          Technician signature / date
        </div>
        <div className="line">Supervisor signature / date</div>
      </div>

      <p className="mt-6 text-[10px] text-slate-400 print:mt-4">
        Generated {formatDate(new Date())} · M.E.U.T. PM Work Order
      </p>
    </article>
  );
}

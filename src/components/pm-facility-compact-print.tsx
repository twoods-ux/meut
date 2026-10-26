import React from "react";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  pmStepOutOfLimit,
  pmStepPrintResult,
  type PmChecklistItem,
} from "@/lib/pm";
import type { PmWorkOrderPrintModel } from "@/components/pm-work-order-print";
import { PrintSignFill } from "@/components/print-signature";
import { closeTechnicianSignature } from "@/lib/print-signature";

function dash(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const text = String(value).trim();
  return text === "" ? "—" : text;
}

function compactResult(item: PmChecklistItem): string {
  if (item.result === "NA") return "N/A";
  if (item.result === "PASS") return "Pass";
  if (item.result === "FAIL") return "Fail";
  const printed = pmStepPrintResult(item);
  return printed || "—";
}

function compactReading(item: PmChecklistItem): string {
  if (item.stepType === "NUMERIC") {
    if (item.result === "NA") return "N/A";
    if (item.reading == null) return "—";
    const unit = item.unit ? ` ${item.unit}` : "";
    const oor = pmStepOutOfLimit(item) ? " OUT" : "";
    return `${item.reading}${unit}${oor}`;
  }
  if (item.stepType === "NOTE") {
    if (item.result === "NA") return "N/A";
    return item.note?.trim() || "—";
  }
  if (item.result === "NA") return "N/A";
  return "—";
}

function woResult(wo: PmWorkOrderPrintModel): string {
  if (wo.pmResult === "PASS") return "Pass";
  if (wo.pmResult === "FAIL") return "Fail";
  if (wo.status === "CLOSED") return "—";
  return "—";
}

/**
 * One facility-batch PM report, laid out to fit a single US Letter page.
 * The single-work-order print keeps PmWorkOrderPrintDocument.
 */
export function PmFacilityCompactSheet({
  organizationName,
  logoSrc,
  wo,
  checklistItems,
}: {
  organizationName: string;
  logoSrc: string | null;
  wo: PmWorkOrderPrintModel;
  checklistItems: PmChecklistItem[];
}) {
  const headerLogo = logoSrc || "/meut-logo.png";
  const procedure = wo.pmTemplateName
    ? `${wo.pmTemplateName}${wo.pmTemplateVersion != null ? ` v${wo.pmTemplateVersion}` : ""}`
    : null;
  const equipment =
    wo.equipment.description || wo.equipment.model || wo.equipment.controlNum;
  const tech = wo.assignedTech?.name || wo.assignedTechCode;

  const fields: Array<[string, string]> = [
    ["Equipment", dash(equipment)],
    ["Control #", dash(wo.controlNum || wo.equipment.controlNum)],
    ["Model", dash(wo.equipment.model)],
    ["Serial", dash(wo.equipment.serial)],
    ["Location", dash(wo.equipment.location)],
    ["Facility", dash(wo.equipment.hospital?.name)],
    ["Department", dash(wo.equipment.department?.name)],
    ["Manufacturer", dash(wo.equipment.manufacturer)],
    ["Work order", String(wo.woNumber)],
    ["Opened", formatDateTime(wo.dateOpened)],
    ["Closed", formatDate(wo.dateClosed)],
    ["Tech", dash(tech)],
    ["Status", wo.pmResult ? `${dash(wo.status)} · ${woResult(wo)}` : dash(wo.status)],
    ["PM month", dash(wo.pmMonth)],
    ["Schedule", dash(wo.pmSchedule1 || wo.equipment.pmSchedule1)],
    ["Next due", formatDate(wo.equipment.pmNextDue)],
  ];

  return (
    <article className="pm-compact-sheet" data-pm-compact-sheet="">
      <div className="pm-compact-scale" data-pm-compact-scale="">
        <div className="pm-compact-top">
          <header className="pm-compact-banner">
            <div className="pm-compact-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={headerLogo} alt="" />
              <div>
                <p className="pm-compact-kicker">Preventive maintenance</p>
                <p className="pm-compact-title">PM Work Order #{wo.woNumber}</p>
              </div>
            </div>
            <p className="pm-compact-org">{organizationName}</p>
          </header>

          <div className="pm-compact-grid">
            {fields.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>

        <section className="pm-compact-mid">
          <h2 className="pm-compact-section">
            Procedure steps{procedure ? ` · ${procedure}` : ""}
          </h2>
          {checklistItems.length > 0 ? (
            <table className="pm-compact-steps">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Step</th>
                  <th className="result">Result</th>
                  <th className="reading">Reading</th>
                </tr>
              </thead>
              <tbody>
                {checklistItems.map((item, index) => (
                  <tr key={item.id}>
                    <td className="num">{index + 1}</td>
                    <td>
                      {item.text}
                      {item.required ? " *" : ""}
                    </td>
                    <td className="result">{compactResult(item)}</td>
                    <td className="reading">{compactReading(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="pm-compact-note">No procedure steps on this work order.</p>
          )}
        </section>

        <footer className="pm-compact-foot">
          <h2 className="pm-compact-section">Notes</h2>
          {wo.workPerformed ? (
            <p className="pm-compact-note">
              <span>Performed</span>
              {wo.workPerformed}
            </p>
          ) : null}
          {wo.comments ? (
            <p className="pm-compact-note">
              <span>Comments</span>
              {wo.comments}
            </p>
          ) : null}
          {!wo.workPerformed && !wo.comments ? (
            <p className="pm-compact-note">None</p>
          ) : null}

          <h2 className="pm-compact-section">Reopen log</h2>
          {wo.events.length > 0 ? (
            <table className="pm-compact-reopen">
              <thead>
                <tr>
                  <th className="when">When</th>
                  <th className="who">Supervisor</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {wo.events.map((event) => (
                  <tr key={event.id}>
                    <td className="when">{formatDateTime(event.createdAt)}</td>
                    <td className="who">{dash(event.actor?.name)}</td>
                    <td>{event.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="pm-compact-note">None</p>
          )}

          <h2 className="pm-compact-section">Signatures</h2>
          <div className="pm-compact-signs">
            <div>
              <PrintSignFill
                compact
                signature={closeTechnicianSignature({
                  status: wo.status,
                  type: "PM",
                  dateClosed: wo.dateClosed,
                  assignedTech: wo.assignedTech,
                  closedBy: wo.closedBy,
                })}
              />
              Technician / date
            </div>
            <div>Supervisor / date</div>
          </div>
        </footer>
      </div>
      <div className="pm-compact-watermark" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/meut-logo.png" alt="" />
      </div>
    </article>
  );
}

import React from "react";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  pmStepOutOfLimit,
  pmStepPrintResult,
  type PmChecklistItem,
} from "@/lib/pm";
import type { PmWorkOrderPrintModel } from "@/components/pm-work-order-print";

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

  return (
    <article className="pm-compact-sheet" data-pm-compact-sheet="">
      <div data-pm-compact-scale="">
        <header className="pm-compact-banner">
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={headerLogo} alt="" />
            <div>
              <p className="pm-compact-kicker">Preventive maintenance</p>
              <p className="pm-compact-title">PM Work Order #{wo.woNumber}</p>
            </div>
          </div>
          <p className="pm-compact-org">{organizationName}</p>
        </header>

        <table className="pm-compact-meta">
          <tbody>
            <tr>
              <th>Equipment</th>
              <td>{dash(equipment)}</td>
              <th>Control #</th>
              <td>{dash(wo.controlNum || wo.equipment.controlNum)}</td>
              <th>Model</th>
              <td>{dash(wo.equipment.model)}</td>
              <th>Serial</th>
              <td>{dash(wo.equipment.serial)}</td>
            </tr>
            <tr>
              <th>Location</th>
              <td>{dash(wo.equipment.location)}</td>
              <th>Facility</th>
              <td>{dash(wo.equipment.hospital?.name)}</td>
              <th>Dept</th>
              <td>{dash(wo.equipment.department?.name)}</td>
              <th>Mfr</th>
              <td>{dash(wo.equipment.manufacturer)}</td>
            </tr>
            <tr>
              <th>WO</th>
              <td>{wo.woNumber}</td>
              <th>Opened</th>
              <td>{formatDateTime(wo.dateOpened)}</td>
              <th>Closed</th>
              <td>{formatDate(wo.dateClosed)}</td>
              <th>Tech</th>
              <td>{dash(tech)}</td>
            </tr>
            <tr>
              <th>Status</th>
              <td>
                {dash(wo.status)}
                {wo.pmResult ? ` · ${woResult(wo)}` : ""}
              </td>
              <th>PM month</th>
              <td>{dash(wo.pmMonth)}</td>
              <th>Schedule</th>
              <td>{dash(wo.pmSchedule1 || wo.equipment.pmSchedule1)}</td>
              <th>Next due</th>
              <td>{formatDate(wo.equipment.pmNextDue)}</td>
            </tr>
          </tbody>
        </table>

        {wo.workPerformed ? (
          <p className="pm-compact-note">
            <strong>Work performed </strong>
            {wo.workPerformed}
          </p>
        ) : null}
        {wo.comments ? (
          <p className="pm-compact-note">
            <strong>Notes </strong>
            {wo.comments}
          </p>
        ) : null}

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

        <h2 className="pm-compact-section">Reopen log</h2>
        {wo.events.length > 0 ? (
          <table className="pm-compact-reopen">
            <thead>
              <tr>
                <th>When</th>
                <th>Supervisor</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {wo.events.map((event) => (
                <tr key={event.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {formatDateTime(event.createdAt)}
                  </td>
                  <td>{dash(event.actor?.name)}</td>
                  <td>{event.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="pm-compact-note">None</p>
        )}

        <div className="pm-compact-signs">
          <div>Technician signature / date</div>
          <div>Supervisor signature / date</div>
        </div>
      </div>
      <div className="pm-compact-watermark" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/meut-logo.png" alt="" />
      </div>
    </article>
  );
}

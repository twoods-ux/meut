import Link from "next/link";
import { Printer } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import {
  buildPrintHref,
  reportTypeLabel,
  statusLabelFor,
  type ParsedReportFilters,
} from "@/lib/report-filters";

type WoRow = {
  id: string;
  woNumber: number;
  status: string;
  priority: string | null;
  controlNum: string | null;
  workRequested: string | null;
  dateOpened: Date;
  laborHours: number | null;
  pmMonth: string | null;
  pmSchedule1: string | null;
  assignedTechCode: string | null;
  assignedTech: { name: string } | null;
  equipment: {
    controlNum: string;
    pmSchedule1: string | null;
    hospital: { name: string } | null;
  };
};

type EqRow = {
  id: string;
  controlNum: string;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  location: string | null;
  onPm: boolean;
  status: string;
  hospId: string | null;
  costCtr: string | null;
  hospital: { name: string } | null;
  department: { name: string } | null;
};

type ContractRow = {
  id: string;
  contractNum: string;
  name: string | null;
  vendorName: string | null;
  hospId: string | null;
  expirationDate: Date | null;
  contractCost: number | null;
  active: boolean;
  hospital: { name: string } | null;
};

type WarrantyRow = {
  id: string;
  controlNum: string;
  description: string | null;
  model: string | null;
  hospId: string | null;
  warrantyPartsEnd: Date | null;
  warrantyLaborEnd: Date | null;
  hospital: { name: string } | null;
};

export type ReportData =
  | { kind: "cm" | "pm"; rows: WoRow[] }
  | { kind: "equipment"; rows: EqRow[] }
  | {
      kind: "contracts";
      contracts: ContractRow[];
      warranties: WarrantyRow[];
    };

function filterSummary(
  filters: ParsedReportFilters,
  facilityName?: string | null,
  techName?: string | null
): string {
  if (!filters.type) return "";
  const parts = [
    reportTypeLabel(filters.type),
    statusLabelFor(filters.type, filters.status),
    facilityName || "All facilities",
  ];
  if (filters.type === "cm" || filters.type === "pm") {
    parts.push(techName || "All technicians");
    if (filters.from || filters.to) {
      parts.push(
        `${filters.from || "…"} → ${filters.to || "…"}`
      );
    }
  }
  return parts.join(" · ");
}

export function ReportResults({
  filters,
  data,
  facilityName,
  techName,
}: {
  filters: ParsedReportFilters;
  data: ReportData;
  facilityName?: string | null;
  techName?: string | null;
}) {
  if (!filters.type) return null;
  const printHref = buildPrintHref(filters);
  const count =
    data.kind === "contracts"
      ? data.contracts.length + data.warranties.length
      : data.rows.length;

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Report results
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {filterSummary(filters, facilityName, techName)} · {count}{" "}
            record(s)
          </p>
        </div>
        {printHref ? (
          <Link
            href={printHref}
            target="_blank"
            className="btn-secondary text-xs"
          >
            <Printer className="h-3.5 w-3.5" /> Print this selection
          </Link>
        ) : null}
      </div>

      {data.kind === "cm" || data.kind === "pm" ? (
        <WorkOrderTable kind={data.kind} rows={data.rows} />
      ) : null}
      {data.kind === "equipment" ? <EquipmentTable rows={data.rows} /> : null}
      {data.kind === "contracts" ? (
        <ContractsTables
          contracts={data.contracts}
          warranties={data.warranties}
        />
      ) : null}
    </section>
  );
}

function WorkOrderTable({
  kind,
  rows,
}: {
  kind: "cm" | "pm";
  rows: WoRow[];
}) {
  const isPm = kind === "pm";
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>WO</th>
            {isPm ? <th>PM month</th> : null}
            <th>Control #</th>
            <th>Facility</th>
            {isPm ? <th>Schedule</th> : <th>Priority</th>}
            <th>Status</th>
            <th>Opened</th>
            <th>Tech</th>
            {isPm ? <th>Labor</th> : <th>Work requested</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((wo) => (
            <tr key={wo.id}>
              <td className="font-medium">
                <Link
                  href={
                    isPm
                      ? `/pm-work-orders/${wo.id}`
                      : `/cm-work-orders/${wo.id}`
                  }
                  className="link-brand"
                >
                  {wo.woNumber}
                </Link>
              </td>
              {isPm ? <td>{wo.pmMonth || "—"}</td> : null}
              <td>{wo.controlNum || wo.equipment.controlNum}</td>
              <td>{wo.equipment.hospital?.name || "—"}</td>
              {isPm ? (
                <td>{wo.pmSchedule1 || wo.equipment.pmSchedule1 || "—"}</td>
              ) : (
                <td>{wo.priority || "—"}</td>
              )}
              <td>
                <StatusBadge status={wo.status} />
              </td>
              <td>{formatDate(wo.dateOpened)}</td>
              <td>{wo.assignedTech?.name || wo.assignedTechCode || "—"}</td>
              {isPm ? (
                <td>
                  {wo.laborHours != null ? `${wo.laborHours}h` : "—"}
                </td>
              ) : (
                <td className="max-w-md truncate">
                  {wo.workRequested || "—"}
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={isPm ? 9 : 8}
                className="py-6 text-center text-slate-400"
              >
                No work orders match this selection
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function EquipmentTable({ rows }: { rows: EqRow[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Control #</th>
            <th>Description</th>
            <th>Manufacturer</th>
            <th>Model</th>
            <th>Serial</th>
            <th>Facility</th>
            <th>Department</th>
            <th>Location</th>
            <th>On PM</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="font-medium">
                <Link href={`/equipment/${e.id}`} className="link-brand">
                  {e.controlNum}
                </Link>
              </td>
              <td>{e.description || "—"}</td>
              <td>{e.manufacturer || "—"}</td>
              <td>{e.model || "—"}</td>
              <td>{e.serial || "—"}</td>
              <td>{e.hospital?.name || e.hospId || "—"}</td>
              <td>{e.department?.name || e.costCtr || "—"}</td>
              <td>{e.location || "—"}</td>
              <td>{e.onPm ? "Yes" : "No"}</td>
              <td>
                <StatusBadge status={e.status} />
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="py-6 text-center text-slate-400">
                No equipment matches this selection
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ContractsTables({
  contracts,
  warranties,
}: {
  contracts: ContractRow[];
  warranties: WarrantyRow[];
}) {
  const now = new Date();
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">
          Service contracts
        </h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contract #</th>
                <th>Name</th>
                <th>Vendor</th>
                <th>Facility</th>
                <th>Expires</th>
                <th>Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contracts.map((c) => {
                const expired =
                  c.expirationDate && c.expirationDate < now;
                const soon =
                  c.expirationDate &&
                  c.expirationDate >= now &&
                  c.expirationDate.getTime() - now.getTime() <
                    90 * 86400000;
                const label =
                  !c.active || expired
                    ? "EXPIRED"
                    : soon
                      ? "SOON"
                      : "ACTIVE";
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
                    <td>
                      <StatusBadge status={label} />
                    </td>
                  </tr>
                );
              })}
              {contracts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-slate-400"
                  >
                    No contracts match this selection
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">
          Warranty expirations
        </h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Control #</th>
                <th>Description</th>
                <th>Facility</th>
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
              {warranties.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 text-center text-slate-400"
                  >
                    No warranty dates on file for this selection
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

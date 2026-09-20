"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Printer } from "lucide-react";
import type { ReportType } from "@/lib/report-filters";

type FacilityOpt = { id: string; name: string; hospId: string };
type TechOpt = {
  id: string;
  name: string;
  techId: string | null;
  username: string;
  role: string;
};

type Defaults = {
  type?: string;
  facility?: string;
  status?: string;
  from?: string;
  to?: string;
  tech?: string;
  pmResult?: string;
};

const REPORT_OPTIONS: {
  value: ReportType;
  label: string;
  hint: string;
}[] = [
  {
    value: "cm",
    label: "CM Work Orders",
    hint: "Corrective maintenance work order list",
  },
  {
    value: "pm",
    label: "PM Work Orders",
    hint: "Preventive maintenance work order list",
  },
  {
    value: "equipment",
    label: "Equipment Inventory",
    hint: "Device inventory by facility / status",
  },
  {
    value: "contracts",
    label: "Contracts & Warranties",
    hint: "Service contracts and warranty expirations",
  },
];

function defaultStatusFor(type: ReportType): string {
  if (type === "cm" || type === "pm") return "OPEN";
  if (type === "equipment" || type === "contracts") return "ACTIVE";
  return "ALL";
}

function statusOptions(type: ReportType): { value: string; label: string }[] {
  if (type === "cm" || type === "pm") {
    return [
      { value: "OPEN", label: "Open" },
      { value: "CLOSED", label: "Closed" },
      { value: "ALL", label: "All" },
    ];
  }
  if (type === "equipment") {
    return [
      { value: "ACTIVE", label: "Active" },
      { value: "RETIRED", label: "Retired" },
      { value: "ALL", label: "All" },
    ];
  }
  return [
    { value: "ACTIVE", label: "Active" },
    { value: "ALL", label: "All" },
  ];
}

function buildQuery(values: {
  type: ReportType;
  facility: string;
  status: string;
  from: string;
  to: string;
  tech: string;
  pmResult: string;
}): string {
  const q = new URLSearchParams();
  q.set("type", values.type);
  if (values.facility && values.facility !== "ALL") {
    q.set("facility", values.facility);
  }
  q.set("status", values.status);
  if (values.type === "cm" || values.type === "pm") {
    if (values.from) q.set("from", values.from);
    if (values.to) q.set("to", values.to);
    if (values.tech && values.tech !== "ALL") q.set("tech", values.tech);
  }
  if (values.type === "pm" && values.pmResult && values.pmResult !== "ALL") {
    q.set("pmResult", values.pmResult);
  }
  return q.toString();
}

function printPath(type: ReportType): string {
  switch (type) {
    case "cm":
      return "/reports/print/cm";
    case "pm":
      return "/reports/print/pm";
    case "equipment":
      return "/reports/print/equipment";
    case "contracts":
      return "/reports/print/contracts";
  }
}

export function ReportGeneratorForm({
  facilities,
  techs,
  defaults,
}: {
  facilities: FacilityOpt[];
  techs: TechOpt[];
  defaults: Defaults;
}) {
  const router = useRouter();
  const initialType = (REPORT_OPTIONS.find((o) => o.value === defaults.type)
    ?.value || "cm") as ReportType;

  const [type, setType] = useState<ReportType>(initialType);
  const [facility, setFacility] = useState(defaults.facility || "ALL");
  const [status, setStatus] = useState(
    defaults.status || defaultStatusFor(initialType)
  );
  const [from, setFrom] = useState(defaults.from || "");
  const [to, setTo] = useState(defaults.to || "");
  const [tech, setTech] = useState(defaults.tech || "ALL");
  const [pmResult, setPmResult] = useState(
    (defaults.pmResult || "ALL").toUpperCase()
  );

  const statuses = useMemo(() => statusOptions(type), [type]);
  const isWorkOrder = type === "cm" || type === "pm";
  const isPm = type === "pm";

  function onTypeChange(next: ReportType) {
    setType(next);
    const allowed = statusOptions(next).map((s) => s.value);
    if (!allowed.includes(status)) {
      setStatus(defaultStatusFor(next));
    }
    if (next !== "pm") setPmResult("ALL");
  }

  function currentQuery() {
    return buildQuery({ type, facility, status, from, to, tech, pmResult });
  }

  function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/reports?${currentQuery()}`);
  }

  function onPrint() {
    const qs = currentQuery();
    // Strip type from print URL — print routes are type-specific
    const params = new URLSearchParams(qs);
    params.delete("type");
    const rest = params.toString();
    window.open(
      rest ? `${printPath(type)}?${rest}` : printPath(type),
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <form onSubmit={onGenerate} className="card space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          What do you want to print?
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose a report, set filters, then Generate to preview on-screen or
          Print the exact selection.
        </p>
      </div>

      <fieldset>
        <legend className="label">1. Report type</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {REPORT_OPTIONS.map((opt) => {
            const selected = type === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                  selected
                    ? "border-brand-400 bg-brand-50/80 ring-2 ring-brand-400/40"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="reportType"
                  className="mt-1"
                  checked={selected}
                  onChange={() => onTypeChange(opt.value)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {opt.hint}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <p className="label mb-2">2. Filters</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="report-facility">
              Facility
            </label>
            <select
              id="report-facility"
              className="input"
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
            >
              <option value="ALL">All facilities</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.hospId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="report-status">
              Status
            </label>
            <select
              id="report-status"
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {isPm ? (
            <div>
              <label className="label" htmlFor="report-pm-result">
                Pass / Fail
              </label>
              <select
                id="report-pm-result"
                className="input"
                value={pmResult}
                onChange={(e) => setPmResult(e.target.value)}
              >
                <option value="ALL">All</option>
                <option value="PASS">Pass</option>
                <option value="FAIL">Fail</option>
              </select>
            </div>
          ) : null}

          {isWorkOrder ? (
            <div>
              <label className="label" htmlFor="report-tech">
                Technician
              </label>
              <select
                id="report-tech"
                className="input"
                value={tech}
                onChange={(e) => setTech(e.target.value)}
              >
                <option value="ALL">All technicians</option>
                {techs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.techId ? ` (${t.techId})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {isWorkOrder ? (
            <>
              <div>
                <label className="label" htmlFor="report-from">
                  Date opened — from
                </label>
                <input
                  id="report-from"
                  type="date"
                  className="input"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="report-to">
                  Date opened — to
                </label>
                <input
                  id="report-to"
                  type="date"
                  className="input"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button type="submit" className="btn-primary">
          <FileSearch className="h-4 w-4" />
          Generate
        </button>
        <button type="button" className="btn-secondary" onClick={onPrint}>
          <Printer className="h-4 w-4" />
          Print
        </button>
        <p className="text-xs text-slate-400 sm:ml-2">
          Generate shows results below · Print opens a printable view of this
          selection
        </p>
      </div>
    </form>
  );
}

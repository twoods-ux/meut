"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { closeWorkOrder, findOpenWorkOrders } from "@/lib/actions";
import { StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

type OpenWo = {
  id: string;
  woNumber: number;
  type: string;
  status: string;
  controlNum: string | null;
  workRequested: string | null;
  pmMonth: string | null;
  dateOpened: Date | string;
  equipment: {
    id: string;
    controlNum: string;
    description: string | null;
    model: string | null;
  };
  assignedTech: { id: string; name: string; techId: string | null } | null;
};

export function QuickCloseForm() {
  const woRef = useRef<HTMLInputElement>(null);
  const [woNumber, setWoNumber] = useState("");
  const [controlNum, setControlNum] = useState("");
  const [results, setResults] = useState<OpenWo[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchPending, startSearch] = useTransition();
  const [closingId, setClosingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  useEffect(() => {
    woRef.current?.focus();
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    startSearch(async () => {
      try {
        const rows = await findOpenWorkOrders({
          woNumber: woNumber.trim(),
          controlNum: controlNum.trim(),
        });
        setResults(rows as OpenWo[]);
        setSearched(true);
        if (rows.length === 0) {
          setMessage({ ok: false, text: "No open work orders matched." });
        }
      } catch (err) {
        setResults([]);
        setSearched(true);
        setMessage({
          ok: false,
          text: err instanceof Error ? err.message : "Search failed",
        });
      }
    });
  }

  function onClose(wo: OpenWo, formData: FormData) {
    setMessage(null);
    setClosingId(wo.id);
    startSearch(async () => {
      try {
        await closeWorkOrder(wo.id, formData);
        setResults((prev) => prev.filter((r) => r.id !== wo.id));
        setMessage({
          ok: true,
          text: `Closed ${wo.type} WO #${wo.woNumber}. Ready for the next one.`,
        });
        setWoNumber("");
        setControlNum("");
        woRef.current?.focus();
      } catch (err) {
        setMessage({
          ok: false,
          text: err instanceof Error ? err.message : "Could not close work order",
        });
      } finally {
        setClosingId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ring-1 ${
            message.ok
              ? "bg-emerald-50 text-emerald-800 ring-emerald-600/15"
              : "bg-rose-50 text-rose-800 ring-rose-600/15"
          }`}
          role="status"
        >
          {message.text}
        </div>
      ) : null}

      <form onSubmit={onSearch} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="qc-wo">
              WO #
            </label>
            <input
              ref={woRef}
              id="qc-wo"
              className="input"
              inputMode="numeric"
              autoComplete="off"
              value={woNumber}
              onChange={(ev) => setWoNumber(ev.target.value)}
              placeholder="e.g. 1042"
            />
          </div>
          <div>
            <label className="label" htmlFor="qc-control">
              Control #
            </label>
            <input
              id="qc-control"
              className="input"
              autoComplete="off"
              value={controlNum}
              onChange={(ev) => setControlNum(ev.target.value)}
              placeholder="Equipment Control #"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Enter WO #, Control #, or both. Shows matching OPEN CM and PM work orders.
        </p>
        <button type="submit" className="btn-primary" disabled={searchPending}>
          {searchPending && !closingId ? "Searching…" : "Find open WOs"}
        </button>
      </form>

      {searched && results.length === 0 && !message?.ok ? (
        <p className="text-sm text-slate-500">No open matches. Try another WO or Control #.</p>
      ) : null}

      {results.length > 0 ? (
        <div className="space-y-3">
          {results.map((wo) => (
            <div key={wo.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {wo.type} WO #{wo.woNumber}{" "}
                    <StatusBadge status={wo.status} />
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Control:{" "}
                    <Link
                      href={`/equipment/${wo.equipment.id}`}
                      className="link-brand"
                    >
                      {wo.controlNum || wo.equipment.controlNum}
                    </Link>
                    {" — "}
                    {wo.equipment.description || wo.equipment.model || "equipment"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Opened {formatDate(wo.dateOpened)}
                    {wo.pmMonth ? ` · PM ${wo.pmMonth}` : ""}
                    {wo.assignedTech
                      ? ` · ${wo.assignedTech.name}`
                      : ""}
                  </p>
                  {wo.workRequested ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {wo.workRequested}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={
                    wo.type === "CM"
                      ? `/cm-work-orders/${wo.id}`
                      : `/pm-work-orders/${wo.id}/print`
                  }
                  className="btn-ghost text-xs"
                >
                  Details
                </Link>
              </div>

              <form
                className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  onClose(wo, new FormData(ev.currentTarget));
                }}
              >
                {wo.type === "PM" ? (
                  <div>
                    <label className="label" htmlFor={`pm-${wo.id}`}>
                      Pass / Fail *
                    </label>
                    <select
                      id={`pm-${wo.id}`}
                      className="input w-[7rem] py-1.5 text-sm"
                      name="pmResult"
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Result
                      </option>
                      <option value="PASS">Pass</option>
                      <option value="FAIL">Fail</option>
                    </select>
                  </div>
                ) : null}
                <div>
                  <label className="label" htmlFor={`wp-${wo.id}`}>
                    Work performed
                  </label>
                  <input
                    id={`wp-${wo.id}`}
                    className="input min-w-[12rem]"
                    name="workPerformed"
                    defaultValue={
                      wo.type === "PM"
                        ? "PM completed per procedure"
                        : "Completed"
                    }
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`lh-${wo.id}`}>
                    Hours
                  </label>
                  <input
                    id={`lh-${wo.id}`}
                    className="input w-20"
                    name="laborHours"
                    type="number"
                    step="0.25"
                    min="0"
                    defaultValue={wo.type === "PM" ? "0.5" : "1"}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={closingId === wo.id}
                >
                  {closingId === wo.id ? "Closing…" : "Close WO"}
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

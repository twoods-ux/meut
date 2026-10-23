"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui";
import { formatPmLimit, type PmChecklistItem } from "@/lib/pm";

function stepKindLabel(item: PmChecklistItem): string {
  if (item.stepType === "PASS_FAIL") return "Pass / fail";
  if (item.stepType === "NUMERIC") return "Reading";
  if (item.stepType === "NOTE") return "Note";
  return "Step";
}

function LimitHint({ item }: { item: PmChecklistItem }) {
  const limit = formatPmLimit(item.minValue, item.maxValue, item.unit);
  if (!limit || item.stepType !== "NUMERIC") return null;
  const hasBound = item.minValue != null || item.maxValue != null;
  if (!hasBound) return null;
  return <span className="text-xs text-slate-500">Limit {limit}</span>;
}

export function PmChecklistEditor({
  items,
  readOnly = false,
  sourceLabel,
}: {
  items: PmChecklistItem[];
  readOnly?: boolean;
  sourceLabel?: string | null;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400">No PM steps on this work order yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {sourceLabel ? (
        <p className="text-xs text-slate-500">{sourceLabel}</p>
      ) : null}
      {readOnly ? (
        <PmChecklistReadOnly items={items} />
      ) : (
        items.map((item, index) => (
          <PmChecklistStep key={item.id} item={item} index={index} />
        ))
      )}
    </div>
  );
}

function PmChecklistReadOnly({ items }: { items: PmChecklistItem[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-12">#</th>
            <th>Step</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, index) => (
            <tr key={item.id}>
              <td className="tabular-nums text-slate-500">{index + 1}</td>
              <td className="whitespace-pre-wrap text-sm">
                <span>{item.text}</span>
                {item.required ? (
                  <span className="ml-1 text-rose-600" title="Required">
                    *
                  </span>
                ) : null}
                <span className="mt-1 block text-[11px] uppercase tracking-wide text-slate-400">
                  {stepKindLabel(item)}
                </span>
              </td>
              <td className="text-sm">
                <StepResponse item={item} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepResponse({ item }: { item: PmChecklistItem }) {
  if (item.stepType === "NUMERIC") {
    const limit = formatPmLimit(item.minValue, item.maxValue, null);
    return (
      <div className="space-y-1">
        <p>
          {item.reading == null ? "—" : item.reading}
          {item.unit ? <span className="text-slate-500"> {item.unit}</span> : null}
        </p>
        {limit ? <p className="text-xs text-slate-500">Limit {limit}</p> : null}
        {item.outOfRange ? (
          <span className="badge bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15">
            Out of range
          </span>
        ) : null}
      </div>
    );
  }
  if (item.stepType === "NOTE") {
    return <p className="whitespace-pre-wrap">{item.note || "—"}</p>;
  }
  if (item.stepType === "PASS_FAIL") {
    return item.result ? (
      <StatusBadge status={item.result} />
    ) : (
      <span className="text-xs text-slate-400">—</span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>{item.done ? "Done" : "—"}</span>
      {item.result ? <StatusBadge status={item.result} /> : null}
    </div>
  );
}

function PmChecklistStep({
  item,
  index,
}: {
  item: PmChecklistItem;
  index: number;
}) {
  const [readingText, setReadingText] = useState(
    item.reading == null ? "" : String(item.reading)
  );
  const liveReading = readingText.trim() === "" ? null : Number(readingText);
  const liveOut =
    item.stepType === "NUMERIC" &&
    readingText.trim() !== "" &&
    Number.isFinite(liveReading) &&
    ((item.minValue != null && (liveReading as number) < item.minValue) ||
      (item.maxValue != null && (liveReading as number) > item.maxValue));

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-start gap-2">
        <span className="mt-0.5 w-8 shrink-0 text-xs font-semibold tabular-nums text-slate-400">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-800">
            {item.text}
            {item.required ? (
              <span className="ml-1 text-rose-600" title="Required">
                *
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">
            {stepKindLabel(item)}
            {item.required ? " · required" : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 pl-0 sm:pl-10">
        {item.stepType === "NUMERIC" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span className="sr-only">Reading</span>
              <input
                className="input w-36 py-1.5"
                name={`checklist_reading_${item.id}`}
                inputMode="decimal"
                value={readingText}
                onChange={(event) => setReadingText(event.target.value)}
                aria-invalid={liveOut || undefined}
              />
              {item.unit ? <span className="text-slate-500">{item.unit}</span> : null}
            </label>
            <LimitHint item={item} />
            {liveOut ? (
              <span className="badge bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15">
                Out of range
              </span>
            ) : null}
          </div>
        ) : null}

        {item.stepType === "NOTE" ? (
          <textarea
            className="input"
            name={`checklist_note_${item.id}`}
            rows={2}
            defaultValue={item.note || ""}
            placeholder="Note"
          />
        ) : null}

        {item.stepType === "PASS_FAIL" ? (
          <select
            className="input w-[9rem] py-1 text-sm"
            name={`checklist_result_${item.id}`}
            defaultValue={item.result || ""}
            aria-label={`Result for step ${index + 1}`}
          >
            <option value="">—</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
          </select>
        ) : null}

        {item.stepType === "TEXT" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name={`checklist_done_${item.id}`}
                value="true"
                defaultChecked={item.done}
                className="h-4 w-4 rounded border-slate-300"
              />
              Mark done
            </label>
            <select
              className="input w-[7.5rem] py-1 text-xs"
              name={`checklist_result_${item.id}`}
              defaultValue={item.result || ""}
              aria-label={`Result for step ${index + 1}`}
            >
              <option value="">—</option>
              <option value="PASS">Pass</option>
              <option value="FAIL">Fail</option>
            </select>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PmChecklistPrint({ items }: { items: PmChecklistItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {items.map((item, index) => {
        const limit = formatPmLimit(item.minValue, item.maxValue, item.unit);
        const checked =
          item.done ||
          item.result != null ||
          item.reading != null ||
          Boolean(item.note?.trim());
        return (
          <div
            key={item.id}
            className="border-b border-slate-200 pb-1.5 text-sm"
          >
            <div className="flex items-start gap-3">
              <span className="inline-block h-3.5 w-3.5 shrink-0 border border-slate-400 text-center text-[10px] leading-3">
                {checked ? "✓" : ""}
              </span>
              <span className="w-6 shrink-0 tabular-nums text-slate-500">
                {index + 1}.
              </span>
              <span className="flex-1">
                {item.text}
                {item.required ? " *" : ""}
              </span>
              <span className="w-28 shrink-0 text-right text-xs uppercase text-slate-600">
                {item.stepType === "PASS_FAIL" || item.stepType === "TEXT"
                  ? item.result || (item.done ? "Done" : "")
                  : ""}
              </span>
            </div>
            {item.stepType === "NUMERIC" ? (
              <p className="pl-12 text-xs text-slate-600">
                Reading: {item.reading == null ? "______" : item.reading}
                {item.unit ? ` ${item.unit}` : ""}
                {limit ? ` · limit ${limit}` : ""}
                {item.outOfRange ? " · OUT OF RANGE" : ""}
              </p>
            ) : null}
            {item.stepType === "NOTE" ? (
              <p className="whitespace-pre-wrap pl-12 text-xs text-slate-600">
                {item.note?.trim() ? item.note : "Note: ____________________"}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

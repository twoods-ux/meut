"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { applyPmProcedureMatches } from "@/lib/pm-procedure-actions";

export type ApplyRow = {
  id: string;
  controlNum: string;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  customProcedure: string | null;
  pinnedName: string | null;
  matchName: string | null;
  matchReason: string | null;
  wouldUse: string;
};

export function PmProcedureApplyForm({ rows }: { rows: ApplyRow[] }) {
  const router = useRouter();
  const [overwrite, setOverwrite] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const row of rows) {
      initial[row.id] = !row.customProcedure && Boolean(row.matchName);
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedCount = rows.filter((row) => {
    if (!selected[row.id] || !row.matchName) return false;
    if (row.customProcedure && !overwrite) return false;
    return true;
  }).length;

  function onApply() {
    const formData = new FormData();
    if (overwrite) formData.set("overwriteCustom", "yes");
    for (const row of rows) {
      if (!selected[row.id]) continue;
      if (row.customProcedure && !overwrite) continue;
      formData.append("equipmentId", row.id);
    }
    setError(null);
    startTransition(async () => {
      const result = await applyPmProcedureMatches(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const params = new URLSearchParams({
        pinned: String(result.pinned),
        cleared: String(result.clearedCustom),
        skippedCustom: String(result.skippedCustom),
        skippedNoMatch: String(result.skippedNoMatch),
      });
      router.push(`/pm-procedures/apply?${params.toString()}`);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No equipment matched this filter.</p>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {error}
        </div>
      ) : null}

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-1"
          checked={overwrite}
          onChange={(event) => setOverwrite(event.target.checked)}
        />
        <span>
          Overwrite custom procedures. This clears procedure text on the selected
          devices and pins the library template instead. Devices with custom text
          stay unchanged unless this is checked and the row is selected.
        </span>
      </label>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10">
                <span className="sr-only">Select</span>
              </th>
              <th>Control #</th>
              <th>Description</th>
              <th>Manufacturer / model</th>
              <th>Current</th>
              <th>Library match</th>
              <th>New work order uses</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const blocked = Boolean(row.customProcedure) && !overwrite;
              const noMatch = !row.matchName;
              return (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(selected[row.id]) && !blocked}
                      disabled={blocked || noMatch}
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [row.id]: event.target.checked,
                        }))
                      }
                      aria-label={`Select ${row.controlNum}`}
                    />
                  </td>
                  <td>
                    <Link href={`/equipment/${row.id}`} className="link-brand">
                      {row.controlNum}
                    </Link>
                  </td>
                  <td>{row.description || "—"}</td>
                  <td>
                    {[row.manufacturer, row.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="max-w-[14rem] truncate" title={row.customProcedure || ""}>
                    {row.customProcedure
                      ? "Custom text"
                      : row.pinnedName
                        ? `Pinned: ${row.pinnedName}`
                        : "—"}
                  </td>
                  <td>
                    {row.matchName ? (
                      <span>
                        {row.matchName}
                        {row.matchReason ? (
                          <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-slate-400">
                            {row.matchReason.replace(/\+/g, " + ")}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      "No match"
                    )}
                  </td>
                  <td className="text-sm">{row.wouldUse}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="btn-primary"
        disabled={pending || selectedCount === 0}
        onClick={onApply}
      >
        {pending ? "Applying…" : `Pin library match on ${selectedCount} selected`}
      </button>
    </div>
  );
}

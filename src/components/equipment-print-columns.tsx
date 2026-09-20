"use client";

import { useMemo, useState, useTransition } from "react";
import { Columns3, Check } from "lucide-react";
import {
  EQUIPMENT_PRINT_COLUMNS,
  type EquipmentPrintColumnId,
} from "@/lib/equipment-print-columns";
import { saveEquipmentPrintPrefs } from "@/lib/actions";

export function EquipmentPrintColumns({
  initialColumns,
}: {
  initialColumns: EquipmentPrintColumnId[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EquipmentPrintColumnId[]>(initialColumns);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggle(id: EquipmentPrintColumnId) {
    setMessage(null);
    setSelected((prev) => {
      if (prev.includes(id)) {
        // Keep at least one column
        if (prev.length <= 1) return prev;
        return prev.filter((c) => c !== id);
      }
      // Append in canonical catalog order
      const next = new Set(prev);
      next.add(id);
      return EQUIPMENT_PRINT_COLUMNS.map((c) => c.id).filter((c) =>
        next.has(c)
      );
    });
  }

  function selectDefaults() {
    setMessage(null);
    setSelected(
      EQUIPMENT_PRINT_COLUMNS.filter((c) =>
        [
          "controlNum",
          "description",
          "manufacturer",
          "model",
          "serial",
          "facility",
          "department",
          "location",
          "onPm",
          "risk",
          "status",
        ].includes(c.id)
      ).map((c) => c.id)
    );
  }

  function selectAll() {
    setMessage(null);
    setSelected(EQUIPMENT_PRINT_COLUMNS.map((c) => c.id));
  }

  function onSave() {
    setMessage(null);
    startTransition(async () => {
      try {
        await saveEquipmentPrintPrefs(selected);
        setMessage({ ok: true, text: "Print columns saved." });
      } catch (e) {
        setMessage({
          ok: false,
          text: e instanceof Error ? e.message : "Could not save",
        });
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-secondary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Columns3 className="h-4 w-4" />
        Print columns
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:w-96">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Equipment print columns
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Choose which fields appear when you print this list. Saved per
                user.
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-xs"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={selectDefaults}
            >
              Defaults
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={selectAll}
            >
              All
            </button>
          </div>

          <ul className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
            {EQUIPMENT_PRINT_COLUMNS.map((col) => {
              const checked = selectedSet.has(col.id);
              return (
                <li key={col.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      checked={checked}
                      onChange={() => toggle(col.id)}
                    />
                    <span>{col.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              className="btn-primary"
              disabled={pending || selected.length === 0}
              onClick={onSave}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            {message ? (
              <p
                className={
                  message.ok
                    ? "flex items-center gap-1 text-xs text-emerald-700"
                    : "text-xs text-red-600"
                }
              >
                {message.ok ? <Check className="h-3.5 w-3.5" /> : null}
                {message.text}
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                {selected.length} column{selected.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

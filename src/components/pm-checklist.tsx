import type { PmChecklistItem } from "@/lib/pm";
import { StatusBadge } from "@/components/ui";

export function PmChecklistEditor({
  items,
  readOnly = false,
}: {
  items: PmChecklistItem[];
  readOnly?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400">No PM steps on this work order yet.</p>
    );
  }

  if (readOnly) {
    return (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th>Step</th>
              <th className="w-24">Done</th>
              <th className="w-28">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="tabular-nums text-slate-500">{item.id}</td>
                <td className="whitespace-pre-wrap text-sm">{item.text}</td>
                <td>{item.done ? "Yes" : "—"}</td>
                <td>
                  {item.result ? (
                    <StatusBadge status={item.result} />
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:flex-row sm:items-start sm:gap-4"
        >
          <span className="mt-0.5 w-8 shrink-0 text-xs font-semibold tabular-nums text-slate-400">
            {item.id}
          </span>
          <p className="min-w-0 flex-1 text-sm text-slate-800">{item.text}</p>
          <label className="flex shrink-0 items-center gap-2 text-sm text-slate-700">
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
            title="Step result"
          >
            <option value="">—</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
          </select>
        </div>
      ))}
    </div>
  );
}

export function PmChecklistPrint({ items }: { items: PmChecklistItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 border-b border-slate-200 pb-1.5 text-sm"
        >
          <span className="inline-block h-3.5 w-3.5 shrink-0 border border-slate-400">
            {item.done || item.result ? "✓" : ""}
          </span>
          <span className="w-6 shrink-0 tabular-nums text-slate-500">{item.id}.</span>
          <span className="flex-1">{item.text}</span>
          <span className="w-14 shrink-0 text-right text-xs uppercase text-slate-500">
            {item.result || (item.done ? "Done" : "")}
          </span>
        </div>
      ))}
    </div>
  );
}

import { formatDate } from "@/lib/utils";
import { isPmDueThisMonth, isPmOverdue } from "@/lib/pm";
import { cn } from "@/lib/utils";

export function PmDueBadge({
  pmNextDue,
  compact = false,
}: {
  pmNextDue: Date | string | null | undefined;
  compact?: boolean;
}) {
  if (!pmNextDue) {
    return compact ? (
      <span className="text-xs text-slate-400">—</span>
    ) : null;
  }
  const overdue = isPmOverdue(pmNextDue);
  const dueMonth = !overdue && isPmDueThisMonth(pmNextDue);
  const label = formatDate(pmNextDue);

  if (overdue) {
    return (
      <span
        className={cn(
          "inline-flex flex-wrap items-center gap-1",
          compact ? "text-xs" : "text-sm"
        )}
        title="Past next due"
      >
        <span className="tabular-nums text-slate-700">{label}</span>
        <span className="badge bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15">
          Overdue
        </span>
      </span>
    );
  }
  if (dueMonth) {
    return (
      <span
        className={cn(
          "inline-flex flex-wrap items-center gap-1",
          compact ? "text-xs" : "text-sm"
        )}
        title="Due this month"
      >
        <span className="tabular-nums text-slate-700">{label}</span>
        <span className="badge bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/15">
          Due
        </span>
      </span>
    );
  }
  return (
    <span className={cn("tabular-nums text-slate-600", compact ? "text-xs" : "text-sm")}>
      {label}
    </span>
  );
}

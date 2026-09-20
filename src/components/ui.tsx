import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "brand" | "sky" | "amber" | "emerald" | "rose" | "slate";
}) {
  const tones: Record<string, string> = {
    brand: "from-brand-500 to-brand-700",
    sky: "from-sky-500 to-cyan-600",
    amber: "from-amber-500 to-orange-600",
    emerald: "from-emerald-500 to-teal-600",
    rose: "from-rose-500 to-pink-600",
    slate: "from-slate-500 to-slate-700",
  };
  return (
    <div className="card relative overflow-hidden transition duration-200 hover:shadow-card">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
          tones[tone]
        )}
      />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2.5 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cls =
    s === "OPEN" || s === "ACTIVE" || s === "PASS"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15"
      : s === "CLOSED"
        ? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/10"
        : s === "RETIRED" || s === "CANCELLED" || s === "FAIL"
          ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15"
          : s === "CUSTOMER"
            ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/15"
            : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/15";
  return <span className={cn("badge", cls)}>{status}</span>;
}

export function EmptyState({
  message,
  title = "Nothing here yet",
}: {
  message: string;
  title?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-soft">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
        <Inbox className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
    </div>
  );
}

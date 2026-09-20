import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { PrintButton } from "@/components/print-button";

/** Shared header for printable documents: logo, org name, date, optional title. */
export function PrintHeader({
  organizationName,
  title,
  subtitle,
  logoSrc,
}: {
  organizationName: string;
  title: string;
  subtitle?: string;
  /** Custom org logo URL; defaults to MEUT mark */
  logoSrc?: string | null;
}) {
  const printed = formatDate(new Date());
  const src = logoSrc || "/meut-logo.png";
  const usingCustom = Boolean(logoSrc);
  return (
    <header className="mb-6 border-b-2 border-brand-500 pb-4 print:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-white p-1.5 ring-1 ring-slate-200 print:ring-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={usingCustom ? organizationName : "M.E.U.T."}
              width={160}
              height={60}
              className="h-10 w-auto max-w-[180px] object-contain print:h-12"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600 print:text-slate-700">
              {usingCustom ? "Powered by M.E.U.T." : "M.E.U.T."}
            </p>
            <p className="text-base font-bold text-slate-900">{organizationName}</p>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="text-right text-sm text-slate-600">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-500">Printed {printed}</p>
        </div>
      </div>
    </header>
  );
}

/** On-screen toolbar: Print + Back (hidden when printing). */
export function PrintToolbar({
  backHref,
  backLabel = "Back",
}: {
  backHref: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
      <PrintButton />
      <Link href={backHref} className="btn-secondary">
        {backLabel}
      </Link>
    </div>
  );
}

/** Labeled field row for WO forms (filled or blank line for handwriting). */
export function PrintField({
  label,
  value,
  blank,
  className = "",
}: {
  label: string;
  value?: string | number | null;
  blank?: boolean;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      {blank ? (
        <div className="mt-1 min-h-[1.75rem] border-b border-slate-400" />
      ) : (
        <p className="mt-0.5 text-sm font-medium text-slate-900">
          {value != null && value !== "" ? String(value) : "—"}
        </p>
      )}
    </div>
  );
}

/** Multi-line block for work requested / performed / comments. */
export function PrintBlock({
  label,
  value,
  blankLines = 4,
  blank,
}: {
  label: string;
  value?: string | null;
  blankLines?: number;
  blank?: boolean;
}) {
  return (
    <div className="mt-4">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      {blank ? (
        <div className="space-y-3">
          {Array.from({ length: blankLines }).map((_, i) => (
            <div key={i} className="border-b border-slate-300" />
          ))}
        </div>
      ) : (
        <p className="min-h-[3rem] whitespace-pre-wrap rounded border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-800 print:border-slate-400 print:bg-white">
          {value || "—"}
        </p>
      )}
    </div>
  );
}

import type { CloseTechnicianSignature } from "@/lib/print-signature";

/** Name and date written in the blank above the signature caption. */
export function PrintSignFill({
  signature,
  compact = false,
}: {
  signature: CloseTechnicianSignature | null;
  compact?: boolean;
}) {
  if (!signature || (!signature.name && !signature.dateLabel)) return null;
  return (
    <span className={compact ? "pm-compact-sign-fill" : "print-sign-fill"}>
      <span>{signature.name || ""}</span>
      {signature.dateLabel ? <span>{signature.dateLabel}</span> : null}
    </span>
  );
}

/**
 * PM schedule + procedure checklist helpers.
 *
 * Next-due bump rule (on successful Pass close of a PM WO):
 * - Use equipment.pmSchedule1 when it is a known code:
 *   M / Monthly → +1 month
 *   Q / Quarterly → +3 months
 *   S / Semi / Semi-Annual → +6 months
 *   A / Annual / Yearly → +12 months
 * - Otherwise default to +1 month from the close date.
 * - Sets equipment.pmLastCompleted = close date and pmNextDue = bumped date.
 */

export type PmStepResult = "PASS" | "FAIL" | null;

export type PmChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  result: PmStepResult;
};

export function toDateInputValue(
  d: Date | string | null | undefined
): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD (or other Date-parseable) as local noon to avoid TZ shifts. */
export function parseDateInput(v: string | null | undefined): Date | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when value looks like an ISO / locale date rather than a schedule code. */
export function looksLikeDateString(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) return true;
  return false;
}

export function isScheduleCode(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toUpperCase();
  return [
    "M",
    "Q",
    "S",
    "A",
    "MONTHLY",
    "QUARTERLY",
    "SEMI",
    "SEMI-ANNUAL",
    "SEMIANNUAL",
    "SEMI_ANNUAL",
    "ANNUAL",
    "YEARLY",
  ].includes(s);
}

/** Months to add for a schedule code; default 1. */
export function scheduleMonths(schedule: string | null | undefined): number {
  if (!schedule) return 1;
  const s = schedule.trim().toUpperCase();
  if (s === "M" || s === "MONTHLY") return 1;
  if (s === "Q" || s === "QUARTERLY") return 3;
  if (
    s === "S" ||
    s === "SEMI" ||
    s === "SEMI-ANNUAL" ||
    s === "SEMIANNUAL" ||
    s === "SEMI_ANNUAL"
  ) {
    return 6;
  }
  if (s === "A" || s === "ANNUAL" || s === "YEARLY") return 12;
  return 1;
}

export function bumpPmNextDue(
  from: Date,
  schedule: string | null | undefined
): Date {
  const months = scheduleMonths(schedule);
  const next = new Date(from);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function isPmOverdue(
  pmNextDue: Date | string | null | undefined,
  now = new Date()
): boolean {
  if (!pmNextDue) return false;
  const d = typeof pmNextDue === "string" ? new Date(pmNextDue) : pmNextDue;
  if (Number.isNaN(d.getTime())) return false;
  return startOfDay(d).getTime() < startOfDay(now).getTime();
}

export function isPmDueThisMonth(
  pmNextDue: Date | string | null | undefined,
  now = new Date()
): boolean {
  if (!pmNextDue) return false;
  const d = typeof pmNextDue === "string" ? new Date(pmNextDue) : pmNextDue;
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

/**
 * Split procedure text into checklist step lines.
 * Handles newlines, numbered lists (1. / 1) / 1 -), and semicolon separators.
 */
export function parsePmProcedureSteps(text: string | null | undefined): string[] {
  const raw = String(text || "").trim();
  if (!raw) return [];

  let parts: string[] = [];
  if (raw.includes("\n")) {
    parts = raw.split(/\r?\n/);
  } else if (/;\s*/.test(raw) && raw.split(";").length > 1) {
    parts = raw.split(";");
  } else if (/\d+[\.\)]\s+/.test(raw)) {
    parts = raw.split(/(?=\d+[\.\)]\s+)/);
  } else {
    parts = [raw];
  }

  return parts
    .map((p) => p.replace(/^\s*\d+[\.\)\-:]+\s*/, "").trim())
    .filter((p) => p.length > 0);
}

export function buildPmChecklist(
  procedureText: string | null | undefined
): PmChecklistItem[] {
  const steps = parsePmProcedureSteps(procedureText);
  if (steps.length === 0) {
    return [
      {
        id: "1",
        text: "Complete preventive maintenance per procedure",
        done: false,
        result: null,
      },
    ];
  }
  return steps.map((text, i) => ({
    id: String(i + 1),
    text,
    done: false,
    result: null,
  }));
}

export function normalizePmChecklist(raw: unknown): PmChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<
      string,
      unknown
    >;
    const resultRaw = String(row.result || "")
      .trim()
      .toUpperCase();
    const result: PmStepResult =
      resultRaw === "PASS" || resultRaw === "FAIL" ? resultRaw : null;
    return {
      id: String(row.id ?? i + 1),
      text: String(row.text ?? "").trim() || `Step ${i + 1}`,
      done: Boolean(row.done) || result === "PASS" || result === "FAIL",
      result,
    };
  });
}

/** Read checklist results from close/save form fields checklist_done_* / checklist_result_*. */
export function checklistFromFormData(
  formData: FormData,
  existing: PmChecklistItem[]
): PmChecklistItem[] {
  return existing.map((item) => {
    const done =
      formData.get(`checklist_done_${item.id}`) === "on" ||
      formData.get(`checklist_done_${item.id}`) === "true";
    const resultRaw = String(formData.get(`checklist_result_${item.id}`) || "")
      .trim()
      .toUpperCase();
    const result: PmStepResult =
      resultRaw === "PASS" || resultRaw === "FAIL" ? resultRaw : null;
    return {
      ...item,
      done: done || result != null,
      result,
    };
  });
}

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
 * - Reopening that Pass undoes this stamp (see src/lib/work-order-reopen.ts).
 *   Closing again stamps from the new close date and does not add a second interval.
 */

export type PmStepResult = "PASS" | "FAIL" | "NA" | null;

/** TEXT is the legacy free-text procedure line. Library steps use the other three. */
export type PmStepType = "TEXT" | "PASS_FAIL" | "NUMERIC" | "NOTE";

export type PmChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  result: PmStepResult;
  stepType: PmStepType;
  required: boolean;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  reading: number | null;
  note: string | null;
  /** True when a numeric reading is outside min/max. Limits are inclusive. */
  outOfRange: boolean;
  templateId: string | null;
  templateName: string | null;
  templateVersion: number | null;
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

export const GENERIC_PM_STEP_TEXT =
  "Complete preventive maintenance per procedure";

export function emptyChecklistFields(
  partial: Pick<PmChecklistItem, "id" | "text"> &
    Partial<Omit<PmChecklistItem, "id" | "text">>
): PmChecklistItem {
  return {
    id: partial.id,
    text: partial.text,
    done: partial.done ?? false,
    result: partial.result ?? null,
    stepType: partial.stepType ?? "TEXT",
    required: partial.required ?? false,
    unit: partial.unit ?? null,
    minValue: partial.minValue ?? null,
    maxValue: partial.maxValue ?? null,
    reading: partial.reading ?? null,
    note: partial.note ?? null,
    outOfRange: partial.outOfRange ?? false,
    templateId: partial.templateId ?? null,
    templateName: partial.templateName ?? null,
    templateVersion: partial.templateVersion ?? null,
  };
}

export function buildPmChecklist(
  procedureText: string | null | undefined
): PmChecklistItem[] {
  const steps = parsePmProcedureSteps(procedureText);
  if (steps.length === 0) {
    return [
      emptyChecklistFields({
        id: "1",
        text: GENERIC_PM_STEP_TEXT,
      }),
    ];
  }
  return steps.map((text, i) =>
    emptyChecklistFields({
      id: String(i + 1),
      text,
    })
  );
}

export function parseStepType(raw: unknown): PmStepType {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (s === "PASS_FAIL" || s === "NUMERIC" || s === "NOTE" || s === "TEXT") {
    return s;
  }
  return "TEXT";
}

export function parseLimit(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

export function parseReading(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw ?? "")
    .trim()
    .replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Accepts PASS, FAIL, and N/A spellings (NA, N/A, not applicable). Anything else is blank. */
export function parsePmStepResult(raw: unknown): PmStepResult {
  const compact = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s._/-]+/g, "");
  if (compact === "PASS") return "PASS";
  if (compact === "FAIL") return "FAIL";
  if (compact === "NA" || compact === "NOTAPPLICABLE") return "NA";
  return null;
}

export function formatPmStepResult(result: PmStepResult | string | null | undefined): string {
  const parsed = parsePmStepResult(result);
  if (parsed === "PASS") return "Pass";
  if (parsed === "FAIL") return "Fail";
  if (parsed === "NA") return "N/A";
  return "";
}

/** Out-of-limit flag for a reading. N/A is never out of limit. */
export function pmStepOutOfLimit(item: Pick<PmChecklistItem, "result" | "outOfRange">): boolean {
  return item.result !== "NA" && item.outOfRange;
}

/**
 * True when a step should count as a failure toward the work-order result.
 * N/A is answered and is not a failure, even if a reading was also stored.
 */
export function pmStepIsFailure(item: Pick<PmChecklistItem, "result" | "outOfRange">): boolean {
  if (item.result === "NA") return false;
  return item.result === "FAIL" || item.outOfRange;
}

export function checklistHasPmFailure(
  items: Array<Pick<PmChecklistItem, "result" | "outOfRange">>
): boolean {
  return items.some(pmStepIsFailure);
}

/** Result column on the PM printout. N/A is written as N/A, not the stored code. */
export function pmStepPrintResult(item: PmChecklistItem): string {
  if (item.result === "NA") return "N/A";
  if (item.stepType === "PASS_FAIL" || item.stepType === "TEXT") {
    if (item.result === "PASS" || item.result === "FAIL") return item.result;
    if (item.done) return "Done";
  }
  return "";
}

/** Reading line on the PM printout. N/A replaces the value and never says out of range. */
export function pmStepPrintReading(item: PmChecklistItem): string | null {
  if (item.stepType !== "NUMERIC") return null;
  if (item.result === "NA") return "Reading: N/A";
  const limit = formatPmLimit(item.minValue, item.maxValue, item.unit);
  const value = item.reading == null ? "______" : String(item.reading);
  const unit = item.unit ? ` ${item.unit}` : "";
  const limitPart = limit ? ` · limit ${limit}` : "";
  const oor = pmStepOutOfLimit(item) ? " · OUT OF RANGE" : "";
  return `Reading: ${value}${unit}${limitPart}${oor}`;
}

function parseOptionalInt(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Inclusive limits. A missing reading is not out of range. */
export function readingOutOfRange(
  reading: number | null,
  minValue: number | null,
  maxValue: number | null
): boolean {
  if (reading == null || Number.isNaN(reading)) return false;
  if (minValue != null && reading < minValue) return true;
  if (maxValue != null && reading > maxValue) return true;
  return false;
}

export function formatPmLimit(
  minValue: number | null,
  maxValue: number | null,
  unit: string | null
): string | null {
  const u = unit ? ` ${unit}` : "";
  if (minValue != null && maxValue != null) return `${minValue}–${maxValue}${u}`;
  if (minValue != null) return `≥ ${minValue}${u}`;
  if (maxValue != null) return `≤ ${maxValue}${u}`;
  return unit ? unit : null;
}

export function normalizePmChecklist(raw: unknown): PmChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<
      string,
      unknown
    >;
    const result = parsePmStepResult(row.result);
    const stepType = parseStepType(row.stepType);
    const minValue = parseLimit(row.minValue);
    const maxValue = parseLimit(row.maxValue);
    const reading = parseReading(row.reading);
    const note = row.note == null ? "" : String(row.note);
    const outOfRange =
      stepType === "NUMERIC" &&
      result !== "NA" &&
      readingOutOfRange(reading, minValue, maxValue);
    let done =
      Boolean(row.done) ||
      result === "PASS" ||
      result === "FAIL" ||
      result === "NA";
    if (stepType === "NUMERIC" && result !== "NA" && reading != null) done = true;
    if (stepType === "NOTE" && note.trim().length > 0) done = true;
    return {
      id: String(row.id ?? i + 1),
      text: String(row.text ?? "").trim() || `Step ${i + 1}`,
      done,
      result,
      stepType,
      required: row.required === true,
      unit: row.unit == null || String(row.unit).trim() === "" ? null : String(row.unit).trim(),
      minValue,
      maxValue,
      reading,
      note: note.trim() ? note : null,
      outOfRange,
      templateId: row.templateId ? String(row.templateId) : null,
      templateName: row.templateName ? String(row.templateName) : null,
      templateVersion: parseOptionalInt(row.templateVersion),
    };
  });
}

/**
 * Read checklist results from close/save form fields.
 * Numeric limits are rechecked here so a tampered "in range" flag cannot stick.
 */
export function checklistFromFormData(
  formData: FormData,
  existing: PmChecklistItem[]
): PmChecklistItem[] {
  return existing.map((item) => {
    const doneChecked =
      formData.get(`checklist_done_${item.id}`) === "on" ||
      formData.get(`checklist_done_${item.id}`) === "true";
    const result = parsePmStepResult(formData.get(`checklist_result_${item.id}`));

    if (item.stepType === "NUMERIC") {
      if (result === "NA") {
        return {
          ...item,
          result: "NA",
          reading: null,
          outOfRange: false,
          done: true,
          note: null,
        };
      }
      const reading = parseReading(formData.get(`checklist_reading_${item.id}`));
      const outOfRange = readingOutOfRange(reading, item.minValue, item.maxValue);
      return {
        ...item,
        reading,
        outOfRange,
        done: reading != null,
        result: null,
        note: null,
      };
    }

    if (item.stepType === "NOTE") {
      const note = String(formData.get(`checklist_note_${item.id}`) || "");
      const trimmed = note.trim();
      return {
        ...item,
        note: trimmed ? note : null,
        done: trimmed.length > 0,
        result: null,
        reading: null,
        outOfRange: false,
      };
    }

    if (item.stepType === "PASS_FAIL") {
      return {
        ...item,
        result,
        done: result != null,
        reading: null,
        note: null,
        outOfRange: false,
      };
    }

    return {
      ...item,
      done: doneChecked || result != null,
      result,
      reading: null,
      note: null,
      outOfRange: false,
    };
  });
}

/** Messages for required steps that are still blank. Empty means the checklist can close. */
export function missingRequiredPmSteps(items: PmChecklistItem[]): string[] {
  const missing: string[] = [];
  items.forEach((item, index) => {
    if (!item.required) return;
    // N/A answers a required step and does not demand a reading or a pass/fail.
    if (item.result === "NA") return;
    const label = `Step ${index + 1} (${item.text})`;
    if (item.stepType === "NUMERIC" && item.reading == null) {
      missing.push(`${label} needs a reading or N/A`);
    } else if (item.stepType === "NOTE" && !item.note?.trim()) {
      missing.push(`${label} needs a note`);
    } else if (
      item.stepType === "PASS_FAIL" &&
      item.result !== "PASS" &&
      item.result !== "FAIL"
    ) {
      missing.push(`${label} needs Pass, Fail, or N/A`);
    } else if (item.stepType === "TEXT" && !item.done && item.result == null) {
      missing.push(`${label} must be marked done`);
    }
  });
  return missing;
}

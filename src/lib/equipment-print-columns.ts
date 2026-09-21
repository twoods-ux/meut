/**
 * Equipment inventory print column definitions and preference helpers.
 * Keys match printable fields from the Equipment model / print table.
 */

export type EquipmentPrintColumnId =
  | "controlNum"
  | "facility"
  | "description"
  | "manufacturer"
  | "model"
  | "serial"
  | "location"
  | "department"
  | "costCtr"
  | "status"
  | "onPm"
  | "risk"
  | "building"
  | "equipOwner"
  | "pmSchedule1"
  | "pmCycleStart";

export type EquipmentPrintColumnDef = {
  id: EquipmentPrintColumnId;
  label: string;
};

/** All columns the user can toggle on the equipment printout. */
export const EQUIPMENT_PRINT_COLUMNS: EquipmentPrintColumnDef[] = [
  { id: "controlNum", label: "Control #" },
  { id: "facility", label: "Facility" },
  { id: "description", label: "Description" },
  { id: "manufacturer", label: "Manufacturer" },
  { id: "model", label: "Model" },
  { id: "serial", label: "Serial" },
  { id: "location", label: "Location" },
  { id: "department", label: "Dept" },
  { id: "costCtr", label: "CostCtr" },
  { id: "status", label: "Status" },
  { id: "onPm", label: "PM" },
  { id: "risk", label: "Risk" },
  { id: "building", label: "Building" },
  { id: "equipOwner", label: "Owner" },
  { id: "pmSchedule1", label: "PM Schedule" },
  { id: "pmCycleStart", label: "PM Cycle Start" },
];

const COLUMN_IDS = new Set(
  EQUIPMENT_PRINT_COLUMNS.map((c) => c.id as string)
);

/** Default columns when the user has no saved preference (matches prior print table + Risk). */
export const DEFAULT_EQUIPMENT_PRINT_COLUMNS: EquipmentPrintColumnId[] = [
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
];

export type UserPrintPrefs = {
  equipmentColumns?: string[];
};

function isColumnId(value: string): value is EquipmentPrintColumnId {
  return COLUMN_IDS.has(value);
}

/** Sanitize a list of column ids — drop unknowns, de-dupe, keep order. */
export function sanitizeEquipmentPrintColumns(
  raw: unknown
): EquipmentPrintColumnId[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: EquipmentPrintColumnId[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!isColumnId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length > 0 ? out : null;
}

/** Resolve columns from User.printPrefs JSON (or defaults). */
export function equipmentColumnsFromPrefs(
  printPrefs: unknown
): EquipmentPrintColumnId[] {
  if (!printPrefs || typeof printPrefs !== "object" || Array.isArray(printPrefs)) {
    return [...DEFAULT_EQUIPMENT_PRINT_COLUMNS];
  }
  const prefs = printPrefs as UserPrintPrefs;
  return (
    sanitizeEquipmentPrintColumns(prefs.equipmentColumns) ?? [
      ...DEFAULT_EQUIPMENT_PRINT_COLUMNS,
    ]
  );
}

/**
 * Resolve print columns: optional `?cols=` comma list overrides saved prefs.
 * Example: ?cols=controlNum,facility,serial,risk
 */
export function resolveEquipmentPrintColumns(opts: {
  printPrefs?: unknown;
  colsParam?: string | null;
}): EquipmentPrintColumnId[] {
  const override = opts.colsParam?.trim();
  if (override) {
    const fromQuery = sanitizeEquipmentPrintColumns(
      override.split(",").map((s) => s.trim()).filter(Boolean)
    );
    if (fromQuery) return fromQuery;
  }
  return equipmentColumnsFromPrefs(opts.printPrefs);
}

export function columnLabel(id: EquipmentPrintColumnId): string {
  return EQUIPMENT_PRINT_COLUMNS.find((c) => c.id === id)?.label ?? id;
}

/** Merge equipmentColumns into existing printPrefs JSON. */
export function mergeEquipmentPrintPrefs(
  existing: unknown,
  columns: EquipmentPrintColumnId[]
): UserPrintPrefs {
  const base: UserPrintPrefs =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as UserPrintPrefs) }
      : {};
  return { ...base, equipmentColumns: columns };
}

/** Row shape used by print cell helpers (list + print page). */
export type EquipmentPrintRow = {
  controlNum: string;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  location: string | null;
  costCtr: string | null;
  status: string;
  onPm: boolean;
  risk: string | null;
  building: string | null;
  equipOwner: string | null;
  pmSchedule1: string | null;
  pmCycleStart?: Date | string | null;
  hospId: string | null;
  hospital?: { name: string } | null;
  department?: { name: string } | null;
};

export function equipmentPrintCellValue(
  column: EquipmentPrintColumnId,
  e: EquipmentPrintRow
): string {
  switch (column) {
    case "controlNum":
      return e.controlNum;
    case "facility":
      return e.hospital?.name || e.hospId || "—";
    case "description":
      return e.description || "—";
    case "manufacturer":
      return e.manufacturer || "—";
    case "model":
      return e.model || "—";
    case "serial":
      return e.serial || "—";
    case "location":
      return e.location || "—";
    case "department":
      return e.department?.name || e.costCtr || "—";
    case "costCtr":
      return e.costCtr || "—";
    case "status":
      return e.status;
    case "onPm":
      return e.onPm ? "Yes" : "No";
    case "risk":
      return e.risk || "—";
    case "building":
      return e.building || "—";
    case "equipOwner":
      return e.equipOwner || "—";
    case "pmSchedule1":
      return e.pmSchedule1 || "—";
    case "pmCycleStart": {
      if (!e.pmCycleStart) return "—";
      const d =
        typeof e.pmCycleStart === "string"
          ? new Date(e.pmCycleStart)
          : e.pmCycleStart;
      if (Number.isNaN(d.getTime())) return "—";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${m}/${day}/${y}`;
    }
    default:
      return "—";
  }
}

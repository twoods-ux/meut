import { Prisma } from "@prisma/client";

export const EQUIPMENT_PAGE_SIZE = 100;
export const EQUIPMENT_PRINT_TAKE = 5000;

export type EquipmentFilterParams = {
  q?: string;
  status?: string;
  facility?: string;
  dept?: string;
  onPm?: string;
  page?: string;
  from?: string;
};

export type ParsedEquipmentFilters = {
  q: string;
  status: "ACTIVE" | "RETIRED" | "ALL";
  facilityId: string | null;
  departmentId: string | null;
  onPm: "YES" | "NO" | "ALL";
  page: number;
};

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseEquipmentFilters(
  params: Record<string, string | string[] | undefined> | EquipmentFilterParams
): ParsedEquipmentFilters {
  const q = (one(params.q as string | string[] | undefined) || "").trim();

  let status = (
    one(params.status as string | string[] | undefined) || "ACTIVE"
  ).toUpperCase();
  if (!["ACTIVE", "RETIRED", "ALL"].includes(status)) status = "ACTIVE";

  const facilityRaw = one(params.facility as string | string[] | undefined);
  const facilityId =
    facilityRaw && facilityRaw !== "ALL" ? facilityRaw : null;

  const deptRaw = one(params.dept as string | string[] | undefined);
  const departmentId = deptRaw && deptRaw !== "ALL" ? deptRaw : null;

  let onPm = (
    one(params.onPm as string | string[] | undefined) || "ALL"
  ).toUpperCase();
  if (!["YES", "NO", "ALL"].includes(onPm)) onPm = "ALL";

  const pageRaw = parseInt(
    one(params.page as string | string[] | undefined) || "1",
    10
  );
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  return {
    q,
    status: status as ParsedEquipmentFilters["status"],
    facilityId,
    departmentId,
    onPm: onPm as ParsedEquipmentFilters["onPm"],
    page,
  };
}

export function buildEquipmentWhere(
  organizationId: string,
  filters: ParsedEquipmentFilters
): Prisma.EquipmentWhereInput {
  const where: Prisma.EquipmentWhereInput = { organizationId };

  if (filters.status === "ACTIVE") where.status = "ACTIVE";
  else if (filters.status === "RETIRED") where.status = "RETIRED";

  if (filters.facilityId) where.hospitalId = filters.facilityId;
  if (filters.departmentId) where.departmentId = filters.departmentId;

  if (filters.onPm === "YES") where.onPm = true;
  else if (filters.onPm === "NO") where.onPm = false;

  if (filters.q) {
    where.OR = [
      { controlNum: { contains: filters.q } },
      { serial: { contains: filters.q } },
      { manufacturer: { contains: filters.q } },
      { model: { contains: filters.q } },
      { description: { contains: filters.q } },
      { location: { contains: filters.q } },
      { hospId: { contains: filters.q } },
      { hospital: { name: { contains: filters.q } } },
    ];
  }

  return where;
}

/** Query string for list / print — omits defaults where sensible. */
export function buildEquipmentQuery(
  filters: ParsedEquipmentFilters,
  opts?: { includePage?: boolean; from?: string }
): string {
  const q = new URLSearchParams();
  if (filters.q) q.set("q", filters.q);
  q.set("status", filters.status);
  if (filters.facilityId) q.set("facility", filters.facilityId);
  if (filters.departmentId) q.set("dept", filters.departmentId);
  if (filters.onPm !== "ALL") q.set("onPm", filters.onPm);
  if (opts?.includePage && filters.page > 1) {
    q.set("page", String(filters.page));
  }
  if (opts?.from) q.set("from", opts.from);
  return q.toString();
}

export function equipmentListHref(
  filters: ParsedEquipmentFilters,
  page?: number
): string {
  const next = { ...filters, page: page ?? filters.page };
  const qs = buildEquipmentQuery(next, { includePage: true });
  return qs ? `/equipment?${qs}` : "/equipment";
}

export function equipmentPrintHref(filters: ParsedEquipmentFilters): string {
  const qs = buildEquipmentQuery(filters, { from: "equipment" });
  return qs
    ? `/reports/print/equipment?${qs}`
    : "/reports/print/equipment?from=equipment";
}

export function onPmLabel(onPm: ParsedEquipmentFilters["onPm"]): string {
  if (onPm === "YES") return "On PM";
  if (onPm === "NO") return "Not on PM";
  return "All PM";
}

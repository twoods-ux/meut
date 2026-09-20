import { Prisma } from "@prisma/client";
import { oneParam } from "@/lib/route-params";

export const WORK_ORDER_PAGE_SIZE = 100;
export const WORK_ORDER_PRINT_TAKE = 5000;

export type WorkOrderListKind = "CM" | "PM";

export type WorkOrderFilterParams = {
  q?: string;
  status?: string;
  facility?: string;
  from?: string;
  to?: string;
  tech?: string;
  pmResult?: string;
  pmMonth?: string;
  page?: string;
};

export type ParsedWorkOrderFilters = {
  q: string;
  status: "OPEN" | "CLOSED" | "ALL";
  facilityId: string | null;
  from: string | null; // YYYY-MM-DD
  to: string | null;
  techId: string | null;
  pmResult: "ALL" | "PASS" | "FAIL";
  pmMonth: string | null; // YYYY-MM
  page: number;
};

function one(value: string | string[] | undefined): string | undefined {
  return oneParam(value);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isPmMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

/** End-exclusive next day for inclusive YYYY-MM-DD "to" dates. */
function endOfDayExclusive(isoDate: string): Date {
  const d = new Date(`${isoDate}T00:00:00.000`);
  d.setDate(d.getDate() + 1);
  return d;
}

function startOfDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000`);
}

export function parseWorkOrderFilters(
  params: Record<string, string | string[] | undefined> | WorkOrderFilterParams
): ParsedWorkOrderFilters {
  const q = (one(params.q as string | string[] | undefined) || "").trim();

  let status = (
    one(params.status as string | string[] | undefined) || "OPEN"
  ).toUpperCase();
  if (!["OPEN", "CLOSED", "ALL"].includes(status)) status = "OPEN";

  const facilityRaw = one(params.facility as string | string[] | undefined);
  const facilityId =
    facilityRaw && facilityRaw !== "ALL" ? facilityRaw : null;

  const fromRaw = one(params.from as string | string[] | undefined) || "";
  const toRaw = one(params.to as string | string[] | undefined) || "";
  const from = fromRaw && isIsoDate(fromRaw) ? fromRaw : null;
  const to = toRaw && isIsoDate(toRaw) ? toRaw : null;

  const techRaw = one(params.tech as string | string[] | undefined);
  const techId = techRaw && techRaw !== "ALL" ? techRaw : null;

  let pmResult = (
    one(params.pmResult as string | string[] | undefined) || "ALL"
  ).toUpperCase();
  if (!["ALL", "PASS", "FAIL"].includes(pmResult)) pmResult = "ALL";

  const pmMonthRaw = (
    one(params.pmMonth as string | string[] | undefined) || ""
  ).trim();
  const pmMonth = pmMonthRaw && isPmMonth(pmMonthRaw) ? pmMonthRaw : null;

  const pageRaw = parseInt(
    one(params.page as string | string[] | undefined) || "1",
    10
  );
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  return {
    q,
    status: status as ParsedWorkOrderFilters["status"],
    facilityId,
    from,
    to,
    techId,
    pmResult: pmResult as ParsedWorkOrderFilters["pmResult"],
    pmMonth,
    page,
  };
}

export function buildWorkOrderWhere(
  organizationId: string,
  woType: WorkOrderListKind,
  filters: ParsedWorkOrderFilters
): Prisma.WorkOrderWhereInput {
  const where: Prisma.WorkOrderWhereInput = {
    organizationId,
    type: woType,
  };

  if (filters.status === "OPEN") where.status = "OPEN";
  else if (filters.status === "CLOSED") where.status = "CLOSED";

  if (filters.techId) where.assignedTechId = filters.techId;

  if (filters.from || filters.to) {
    where.dateOpened = {};
    if (filters.from) where.dateOpened.gte = startOfDay(filters.from);
    if (filters.to) where.dateOpened.lt = endOfDayExclusive(filters.to);
  }

  if (woType === "PM") {
    if (
      (filters.status === "CLOSED" || filters.status === "ALL") &&
      (filters.pmResult === "PASS" || filters.pmResult === "FAIL")
    ) {
      where.pmResult = filters.pmResult;
    }
    if (filters.pmMonth) {
      where.pmMonth = filters.pmMonth;
    }
  }

  const and: Prisma.WorkOrderWhereInput[] = [];

  if (filters.facilityId) {
    and.push({ equipment: { hospitalId: filters.facilityId } });
  }

  if (filters.q) {
    const or: Prisma.WorkOrderWhereInput[] = [
      { controlNum: { contains: filters.q } },
      { workRequested: { contains: filters.q } },
      { workPerformed: { contains: filters.q } },
      { comments: { contains: filters.q } },
      { equipment: { controlNum: { contains: filters.q } } },
      { equipment: { description: { contains: filters.q } } },
    ];
    const asNum = Number.parseInt(filters.q, 10);
    if (Number.isFinite(asNum) && String(asNum) === filters.q.trim()) {
      or.push({ woNumber: asNum });
    }
    and.push({ OR: or });
  }

  if (and.length === 1) {
    Object.assign(where, and[0]);
  } else if (and.length > 1) {
    where.AND = and;
  }

  return where;
}

/** Query string for list / print — omits defaults where sensible. */
export function buildWorkOrderQuery(
  filters: ParsedWorkOrderFilters,
  opts?: {
    includePage?: boolean;
    includePmFilters?: boolean;
  }
): string {
  const q = new URLSearchParams();
  if (filters.q) q.set("q", filters.q);
  q.set("status", filters.status);
  if (filters.facilityId) q.set("facility", filters.facilityId);
  if (filters.from) q.set("from", filters.from);
  if (filters.to) q.set("to", filters.to);
  if (filters.techId) q.set("tech", filters.techId);
  if (opts?.includePmFilters) {
    if (filters.pmResult !== "ALL") q.set("pmResult", filters.pmResult);
    if (filters.pmMonth) q.set("pmMonth", filters.pmMonth);
  }
  if (opts?.includePage && filters.page > 1) {
    q.set("page", String(filters.page));
  }
  return q.toString();
}

export function workOrderListHref(
  kind: WorkOrderListKind,
  filters: ParsedWorkOrderFilters,
  page?: number
): string {
  const next = { ...filters, page: page ?? filters.page };
  const qs = buildWorkOrderQuery(next, {
    includePage: true,
    includePmFilters: kind === "PM",
  });
  const base = kind === "CM" ? "/cm-work-orders" : "/pm-work-orders";
  return qs ? `${base}?${qs}` : base;
}

export function workOrderPrintHref(
  kind: WorkOrderListKind,
  filters: ParsedWorkOrderFilters
): string {
  const qs = buildWorkOrderQuery(filters, {
    includePmFilters: kind === "PM",
  });
  const path =
    kind === "CM" ? "/reports/print/cm" : "/reports/print/pm";
  return qs ? `${path}?${qs}` : path;
}

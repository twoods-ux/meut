import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  WORK_ORDER_PRINT_TAKE,
  buildWorkOrderWhere,
  type ParsedWorkOrderFilters,
} from "@/lib/work-order-filters";

export type ReportType = "cm" | "pm" | "equipment" | "contracts";

export type ReportFilterParams = {
  type?: string;
  facility?: string;
  status?: string;
  from?: string;
  to?: string;
  tech?: string;
  pmResult?: string; // ALL | PASS | FAIL — PM reports only
  pmMonth?: string; // YYYY-MM — PM reports only
  q?: string; // look-up text
};

export type ParsedReportFilters = {
  type: ReportType | null;
  facilityId: string | null;
  status: string; // OPEN | CLOSED | ACTIVE | RETIRED | ALL
  from: string | null; // YYYY-MM-DD
  to: string | null;
  techId: string | null;
  pmResult: string; // ALL | PASS | FAIL — meaningful for type pm
  pmMonth: string | null; // YYYY-MM — meaningful for type pm
  q: string;
};

const REPORT_TYPES: ReportType[] = ["cm", "pm", "equipment", "contracts"];

export function parseReportFilters(
  params: ReportFilterParams
): ParsedReportFilters {
  const rawType = (params.type || "").toLowerCase();
  const type = REPORT_TYPES.includes(rawType as ReportType)
    ? (rawType as ReportType)
    : null;

  const facilityId =
    params.facility && params.facility !== "ALL" ? params.facility : null;
  const techId = params.tech && params.tech !== "ALL" ? params.tech : null;

  let status = (params.status || "").toUpperCase();
  if (type === "cm" || type === "pm") {
    if (!["OPEN", "CLOSED", "ALL"].includes(status)) status = "OPEN";
  } else if (type === "equipment") {
    if (!["ACTIVE", "RETIRED", "ALL"].includes(status)) status = "ACTIVE";
  } else if (type === "contracts") {
    if (!["ACTIVE", "ALL"].includes(status)) status = "ACTIVE";
  } else if (!status) {
    status = "ALL";
  }

  const from = params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)
    ? params.from
    : null;
  const to = params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to)
    ? params.to
    : null;

  let pmResult = (params.pmResult || "ALL").toUpperCase();
  if (type === "pm") {
    if (!["ALL", "PASS", "FAIL"].includes(pmResult)) pmResult = "ALL";
  } else {
    pmResult = "ALL";
  }

  const pmMonthRaw = (params.pmMonth || "").trim();
  const pmMonth =
    type === "pm" && /^\d{4}-\d{2}$/.test(pmMonthRaw) ? pmMonthRaw : null;

  const q = (params.q || "").trim();

  return {
    type,
    facilityId,
    status,
    from,
    to,
    techId,
    pmResult,
    pmMonth,
    q,
  };
}

export function buildPrintHref(filters: ParsedReportFilters): string | null {
  if (!filters.type) return null;
  const q = new URLSearchParams();
  if (filters.status) q.set("status", filters.status);
  if (filters.facilityId) q.set("facility", filters.facilityId);
  if (filters.techId) q.set("tech", filters.techId);
  if (filters.from) q.set("from", filters.from);
  if (filters.to) q.set("to", filters.to);
  if (filters.q) q.set("q", filters.q);
  if (filters.type === "pm" && filters.pmResult && filters.pmResult !== "ALL") {
    q.set("pmResult", filters.pmResult);
  }
  if (filters.type === "pm" && filters.pmMonth) {
    q.set("pmMonth", filters.pmMonth);
  }
  const path =
    filters.type === "cm"
      ? "/reports/print/cm"
      : filters.type === "pm"
        ? "/reports/print/pm"
        : filters.type === "equipment"
          ? "/reports/print/equipment"
          : "/reports/print/contracts";
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

export function reportTypeLabel(type: ReportType): string {
  switch (type) {
    case "cm":
      return "CM Work Orders";
    case "pm":
      return "PM Work Orders";
    case "equipment":
      return "Equipment Inventory";
    case "contracts":
      return "Contracts & Warranties";
  }
}

export function statusLabelFor(type: ReportType, status: string): string {
  if (status === "ALL") return "All";
  if (type === "cm" || type === "pm") {
    return status === "CLOSED" ? "Closed" : "Open";
  }
  if (type === "equipment") {
    return status === "RETIRED" ? "Retired" : "Active";
  }
  return status === "ACTIVE" ? "Active" : "All";
}

export function pmResultLabel(pmResult: string): string {
  if (pmResult === "PASS") return "Pass";
  if (pmResult === "FAIL") return "Fail";
  return "All results";
}

function toWorkOrderListFilters(
  filters: ParsedReportFilters
): ParsedWorkOrderFilters {
  const status =
    filters.status === "CLOSED" || filters.status === "ALL"
      ? filters.status
      : "OPEN";
  const pmResult =
    filters.pmResult === "PASS" || filters.pmResult === "FAIL"
      ? filters.pmResult
      : "ALL";
  return {
    q: filters.q || "",
    status,
    facilityId: filters.facilityId,
    from: filters.from,
    to: filters.to,
    techId: filters.techId,
    pmResult,
    pmMonth: filters.pmMonth,
    page: 1,
  };
}

function equipmentWhere(
  organizationId: string,
  filters: ParsedReportFilters
): Prisma.EquipmentWhereInput {
  const where: Prisma.EquipmentWhereInput = { organizationId };
  if (filters.status === "ACTIVE") where.status = "ACTIVE";
  else if (filters.status === "RETIRED") where.status = "RETIRED";
  if (filters.facilityId) where.hospitalId = filters.facilityId;
  return where;
}

function contractsWhere(
  organizationId: string,
  filters: ParsedReportFilters
): Prisma.ServiceContractWhereInput {
  const where: Prisma.ServiceContractWhereInput = { organizationId };
  if (filters.status === "ACTIVE") where.active = true;
  if (filters.facilityId) where.hospitalId = filters.facilityId;
  return where;
}

export async function fetchReportData(
  organizationId: string,
  filters: ParsedReportFilters
) {
  if (!filters.type) return null;

  if (filters.type === "cm" || filters.type === "pm") {
    const woType = filters.type === "cm" ? "CM" : "PM";
    const rows = await prisma.workOrder.findMany({
      where: buildWorkOrderWhere(
        organizationId,
        woType,
        toWorkOrderListFilters(filters)
      ),
      include: {
        equipment: { include: { hospital: true } },
        assignedTech: true,
      },
      orderBy:
        woType === "PM"
          ? [{ pmMonth: "desc" }, { woNumber: "desc" }]
          : { dateOpened: "desc" },
      take: WORK_ORDER_PRINT_TAKE,
    });
    return { kind: filters.type as "cm" | "pm", rows };
  }

  if (filters.type === "equipment") {
    const rows = await prisma.equipment.findMany({
      where: equipmentWhere(organizationId, filters),
      include: { hospital: true, department: true },
      orderBy: { controlNum: "asc" },
      take: 1000,
    });
    return { kind: "equipment" as const, rows };
  }

  const [contracts, warranties] = await Promise.all([
    prisma.serviceContract.findMany({
      where: contractsWhere(organizationId, filters),
      include: { hospital: true },
      orderBy: { expirationDate: "asc" },
    }),
    prisma.equipment.findMany({
      where: {
        organizationId,
        ...(filters.facilityId ? { hospitalId: filters.facilityId } : {}),
        OR: [
          { warrantyPartsEnd: { not: null } },
          { warrantyLaborEnd: { not: null } },
        ],
      },
      include: { hospital: true },
      orderBy: { warrantyPartsEnd: "asc" },
      take: 500,
    }),
  ]);
  return { kind: "contracts" as const, contracts, warranties };
}

export async function loadReportFormOptions(organizationId: string) {
  const [facilities, techs] = await Promise.all([
    prisma.hospital.findMany({
      where: { organizationId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, hospId: true },
    }),
    prisma.user.findMany({
      where: {
        organizationId,
        active: true,
        role: { in: ["TECH", "SUPERVISOR"] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, techId: true, username: true, role: true },
    }),
  ]);
  return { facilities, techs };
}

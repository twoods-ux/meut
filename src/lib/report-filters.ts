import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ReportType = "cm" | "pm" | "equipment" | "contracts";

export type ReportFilterParams = {
  type?: string;
  facility?: string;
  status?: string;
  from?: string;
  to?: string;
  tech?: string;
  pmResult?: string; // ALL | PASS | FAIL — PM reports only
};

export type ParsedReportFilters = {
  type: ReportType | null;
  facilityId: string | null;
  status: string; // OPEN | CLOSED | ACTIVE | RETIRED | ALL
  from: string | null; // YYYY-MM-DD
  to: string | null;
  techId: string | null;
  pmResult: string; // ALL | PASS | FAIL — meaningful for type pm
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

  return { type, facilityId, status, from, to, techId, pmResult };
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

export function buildPrintHref(filters: ParsedReportFilters): string | null {
  if (!filters.type) return null;
  const q = new URLSearchParams();
  if (filters.status) q.set("status", filters.status);
  if (filters.facilityId) q.set("facility", filters.facilityId);
  if (filters.techId) q.set("tech", filters.techId);
  if (filters.from) q.set("from", filters.from);
  if (filters.to) q.set("to", filters.to);
  if (filters.type === "pm" && filters.pmResult && filters.pmResult !== "ALL") {
    q.set("pmResult", filters.pmResult);
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

function workOrderWhere(
  organizationId: string,
  woType: "CM" | "PM",
  filters: ParsedReportFilters
): Prisma.WorkOrderWhereInput {
  const where: Prisma.WorkOrderWhereInput = {
    organizationId,
    type: woType,
  };

  if (filters.status === "OPEN") where.status = "OPEN";
  else if (filters.status === "CLOSED") where.status = "CLOSED";

  if (woType === "PM" && (filters.pmResult === "PASS" || filters.pmResult === "FAIL")) {
    where.pmResult = filters.pmResult;
  }

  if (filters.techId) where.assignedTechId = filters.techId;

  if (filters.from || filters.to) {
    where.dateOpened = {};
    if (filters.from) where.dateOpened.gte = startOfDay(filters.from);
    if (filters.to) where.dateOpened.lt = endOfDayExclusive(filters.to);
  }

  if (filters.facilityId) {
    where.equipment = { hospitalId: filters.facilityId };
  }

  return where;
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
      where: workOrderWhere(organizationId, woType, filters),
      include: {
        equipment: { include: { hospital: true } },
        assignedTech: true,
      },
      orderBy:
        woType === "PM"
          ? [{ pmMonth: "desc" }, { woNumber: "desc" }]
          : { dateOpened: "desc" },
      take: 500,
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

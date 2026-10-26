/**
 * Query for printing every matching PM work order at one facility
 * as a full detail report. The list "Print this list" view stays a summary.
 */

import type { Prisma } from "@prisma/client";
import { parsePmMonth } from "./pm-generate";

/** Full reports are much larger than a summary row. Stop after this many. */
export const FACILITY_PM_DETAIL_PRINT_LIMIT = 200;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type FacilityPmDetailStatus = "completed" | "all";

export type FacilityPmDetailPrintQuery = {
  facilityId: string;
  pmMonth: string | null;
  from: string | null;
  to: string | null;
  status: FacilityPmDetailStatus;
};

export type FacilityPmDetailPrintParseResult =
  | { ok: true; query: FacilityPmDetailPrintQuery }
  | { ok: false; error: string };

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** Inclusive calendar day, local midnight, same boundary the list filters use. */
export function facilityPmPrintStart(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000`);
}

/** End-exclusive next local midnight so the "to" date is included. */
export function facilityPmPrintEndExclusive(isoDate: string): Date {
  const end = facilityPmPrintStart(isoDate);
  end.setDate(end.getDate() + 1);
  return end;
}

function parseStatus(
  raw: string | null
): { ok: true; status: FacilityPmDetailStatus } | { ok: false; error: string } {
  if (raw == null) return { ok: true, status: "completed" };
  const status = raw.toLowerCase();
  if (status === "completed" || status === "closed") {
    return { ok: true, status: "completed" };
  }
  if (status === "all") return { ok: true, status: "all" };
  return { ok: false, error: "Status must be completed or all." };
}

/**
 * Facility is required. A month or an opened-date range is required so a
 * facility's whole history is not printed at once. Empty status means completed.
 */
export function parseFacilityPmDetailPrintQuery(raw: {
  facility?: string | null;
  month?: string | null;
  from?: string | null;
  to?: string | null;
  status?: string | null;
}): FacilityPmDetailPrintParseResult {
  const facilityId = blankToNull(raw.facility);
  if (!facilityId || facilityId.toUpperCase() === "ALL") {
    return { ok: false, error: "Choose a facility." };
  }

  const monthRaw = blankToNull(raw.month);
  let pmMonth: string | null = null;
  if (monthRaw) {
    pmMonth = parsePmMonth(monthRaw);
    if (!pmMonth) return { ok: false, error: "PM month must be YYYY-MM." };
  }

  const fromRaw = blankToNull(raw.from);
  if (fromRaw && !ISO_DATE_RE.test(fromRaw)) {
    return { ok: false, error: "Opened from must be a date." };
  }
  const toRaw = blankToNull(raw.to);
  if (toRaw && !ISO_DATE_RE.test(toRaw)) {
    return { ok: false, error: "Opened to must be a date." };
  }
  if (fromRaw && toRaw && fromRaw > toRaw) {
    return { ok: false, error: "Opened from is after opened to." };
  }

  if (!pmMonth && !fromRaw && !toRaw) {
    return { ok: false, error: "Choose a PM month or a date range." };
  }

  const status = parseStatus(blankToNull(raw.status));
  if (!status.ok) return status;

  return {
    ok: true,
    query: {
      facilityId,
      pmMonth,
      from: fromRaw,
      to: toRaw,
      status: status.status,
    },
  };
}

/**
 * Org-scoped PM work orders for equipment at this facility.
 * Matches hospitalId or the MediMizer hospId, same as PM generation.
 * Completed means CLOSED. All leaves status open.
 */
export function facilityPmDetailPrintWhere(
  organizationId: string,
  facility: { id: string; hospId: string },
  query: FacilityPmDetailPrintQuery
): Prisma.WorkOrderWhereInput {
  const where: Prisma.WorkOrderWhereInput = {
    organizationId,
    type: "PM",
    equipment: {
      organizationId,
      OR: [{ hospitalId: facility.id }, { hospId: facility.hospId }],
    },
  };
  if (query.status === "completed") where.status = "CLOSED";
  if (query.pmMonth) where.pmMonth = query.pmMonth;
  if (query.from || query.to) {
    where.dateOpened = {
      ...(query.from ? { gte: facilityPmPrintStart(query.from) } : {}),
      ...(query.to ? { lt: facilityPmPrintEndExclusive(query.to) } : {}),
    };
  }
  return where;
}

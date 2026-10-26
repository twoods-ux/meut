/**
 * Shared shape for a scheduled PM work order.
 *
 * The monthly bulk run and the single-equipment action both build the work
 * order from this module, so a one-off PM has the same procedure, steps, and
 * duplicate rule as one created by Generate PM WOs.
 */

import type { Prisma } from "@prisma/client";
import type { ResolvedPmProcedure } from "./pm-procedures";

/** YYYY-MM, same pattern the bulk generate form accepts. */
const PM_MONTH_RE = /^\d{4}-\d{2}$/;

export function currentPmMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Blank is not a month. Returns the trimmed YYYY-MM or null. */
export function parsePmMonth(raw: unknown): string | null {
  const month = String(raw ?? "").trim();
  if (!PM_MONTH_RE.test(month)) return null;
  const monthNumber = Number(month.slice(5, 7));
  if (monthNumber < 1 || monthNumber > 12) return null;
  return month;
}

export type ScheduledPmEquipment = {
  id: string;
  controlNum: string;
  hospId: string | null;
  costCtr: string | null;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  pmProc1: string | null;
  pmSchedule1: string | null;
  pmTemplateId: string | null;
  techAssigned1: string | null;
};

/** Non-cancelled PM for a month. Cancelled work orders do not block a new one. */
function scheduledPmMonthWhere(
  organizationId: string,
  pmMonth: string
): Prisma.WorkOrderWhereInput {
  return {
    organizationId,
    type: "PM",
    pmMonth,
    status: { not: "CANCELLED" },
  };
}

/**
 * A PM already on file for this equipment and month.
 * Same skip the bulk generate run uses.
 */
export function scheduledPmDuplicateWhere(
  organizationId: string,
  equipmentId: string,
  pmMonth: string
): Prisma.WorkOrderWhereInput {
  return {
    ...scheduledPmMonthWhere(organizationId, pmMonth),
    equipmentId,
  };
}

/** Same duplicate rule for a set of equipment (the due list). */
export function scheduledPmsForEquipmentWhere(
  organizationId: string,
  pmMonth: string,
  equipmentIds: string[]
): Prisma.WorkOrderWhereInput {
  return {
    ...scheduledPmMonthWhere(organizationId, pmMonth),
    equipmentId: { in: equipmentIds },
  };
}

export function procedureSnapshot(resolved: ResolvedPmProcedure): {
  pmChecklist: Prisma.InputJsonValue;
  pmProcedureSource: string;
  pmTemplateId: string | null;
  pmTemplateName: string | null;
  pmTemplateVersion: number | null;
} {
  return {
    pmChecklist: resolved.items as unknown as Prisma.InputJsonValue,
    pmProcedureSource: resolved.source,
    pmTemplateId: resolved.templateId,
    pmTemplateName: resolved.templateName,
    pmTemplateVersion: resolved.templateVersion,
  };
}

/** Fields written on every new scheduled PM, bulk or single. */
export function buildScheduledPmWorkOrderData(input: {
  organizationId: string;
  woNumber: number;
  equipment: ScheduledPmEquipment;
  month: string;
  dateOpened: Date;
  openedById: string;
  assignedTechId: string | null;
  resolved: ResolvedPmProcedure;
}): Prisma.WorkOrderUncheckedCreateInput {
  const snapshot = procedureSnapshot(input.resolved);
  return {
    organizationId: input.organizationId,
    woNumber: input.woNumber,
    type: "PM",
    status: "OPEN",
    equipmentId: input.equipment.id,
    controlNum: input.equipment.controlNum,
    hospId: input.equipment.hospId,
    costCtr: input.equipment.costCtr,
    workRequested: `Scheduled PM for ${input.month}`,
    pmMonth: input.month,
    pmProc1: input.equipment.pmProc1,
    pmSchedule1: input.equipment.pmSchedule1,
    pmChecklist: snapshot.pmChecklist,
    pmProcedureSource: snapshot.pmProcedureSource,
    pmTemplateId: snapshot.pmTemplateId,
    pmTemplateName: snapshot.pmTemplateName,
    pmTemplateVersion: snapshot.pmTemplateVersion,
    assignedTechCode: input.equipment.techAssigned1,
    assignedTechId: input.assignedTechId,
    openedById: input.openedById,
    dateOpened: input.dateOpened,
  };
}

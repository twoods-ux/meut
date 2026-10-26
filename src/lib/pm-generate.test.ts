import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERIC_PM_STEP_TEXT, type PmChecklistItem } from "./pm";
import {
  buildScheduledPmWorkOrderData,
  currentPmMonth,
  parsePmMonth,
  scheduledPmDuplicateWhere,
  scheduledPmsForEquipmentWhere,
  type ScheduledPmEquipment,
} from "./pm-generate";
import { resolvePmProcedure, type PmTemplateForMatch } from "./pm-procedures";

function equipment(
  partial: Partial<ScheduledPmEquipment> = {}
): ScheduledPmEquipment {
  return {
    id: "eq-1",
    controlNum: "10042",
    hospId: "H1",
    costCtr: "ICU",
    description: "Patient monitor",
    manufacturer: "Philips",
    model: "MX800",
    pmProc1: "1. Visual inspection\n2. Functional test",
    pmSchedule1: "Q",
    pmTemplateId: null,
    techAssigned1: "T3",
    ...partial,
  };
}

describe("parsePmMonth", () => {
  it("accepts a calendar YYYY-MM and trims it", () => {
    assert.equal(parsePmMonth("2026-10"), "2026-10");
    assert.equal(parsePmMonth(" 2026-01 "), "2026-01");
  });

  it("rejects a blank, a partial month, and a month number that is not 01-12", () => {
    assert.equal(parsePmMonth(""), null);
    assert.equal(parsePmMonth("   "), null);
    assert.equal(parsePmMonth("2026-1"), null);
    assert.equal(parsePmMonth("2026-13"), null);
    assert.equal(parsePmMonth("2026-00"), null);
    assert.equal(parsePmMonth("Oct 2026"), null);
  });
});

describe("currentPmMonth", () => {
  it("uses the local calendar month", () => {
    assert.equal(currentPmMonth(new Date(2026, 9, 26, 15, 4)), "2026-10");
    assert.equal(currentPmMonth(new Date(2026, 0, 1)), "2026-01");
  });
});

describe("scheduled PM duplicate rule", () => {
  it("matches one equipment, one month, and ignores cancelled work orders", () => {
    assert.deepEqual(scheduledPmDuplicateWhere("org-1", "eq-1", "2026-10"), {
      organizationId: "org-1",
      equipmentId: "eq-1",
      type: "PM",
      pmMonth: "2026-10",
      status: { not: "CANCELLED" },
    });
  });

  it("uses that same rule for the due-list lookup", () => {
    const where = scheduledPmsForEquipmentWhere("org-1", "2026-10", [
      "eq-1",
      "eq-2",
    ]);
    assert.equal(where.organizationId, "org-1");
    assert.equal(where.type, "PM");
    assert.equal(where.pmMonth, "2026-10");
    assert.deepEqual(where.status, { not: "CANCELLED" });
    assert.deepEqual(where.equipmentId, { in: ["eq-1", "eq-2"] });
  });
});

describe("buildScheduledPmWorkOrderData", () => {
  const opened = new Date(2026, 9, 26, 8, 30);

  it("copies the custom procedure onto an open PM the way the bulk run does", () => {
    const eq = equipment();
    const data = buildScheduledPmWorkOrderData({
      organizationId: "org-1",
      woNumber: 1042,
      equipment: eq,
      month: "2026-10",
      dateOpened: opened,
      openedById: "user-1",
      assignedTechId: "tech-1",
      resolved: resolvePmProcedure(eq, []),
    });

    assert.equal(data.organizationId, "org-1");
    assert.equal(data.woNumber, 1042);
    assert.equal(data.type, "PM");
    assert.equal(data.status, "OPEN");
    assert.equal(data.equipmentId, "eq-1");
    assert.equal(data.controlNum, "10042");
    assert.equal(data.hospId, "H1");
    assert.equal(data.costCtr, "ICU");
    assert.equal(data.workRequested, "Scheduled PM for 2026-10");
    assert.equal(data.pmMonth, "2026-10");
    assert.equal(data.pmProc1, eq.pmProc1);
    assert.equal(data.pmSchedule1, "Q");
    assert.equal(data.pmProcedureSource, "CUSTOM");
    assert.equal(data.pmTemplateId, null);
    assert.equal(data.assignedTechCode, "T3");
    assert.equal(data.assignedTechId, "tech-1");
    assert.equal(data.openedById, "user-1");
    assert.equal(data.dateOpened, opened);

    const checklist = data.pmChecklist as PmChecklistItem[];
    assert.equal(checklist.length, 2);
    assert.equal(checklist[0]?.text, "Visual inspection");
    assert.equal(checklist[1]?.text, "Functional test");
    assert.equal(checklist[0]?.stepType, "TEXT");
    assert.equal(checklist[0]?.done, false);
  });

  it("snapshots a library procedure when the equipment has no custom text", () => {
    const eq = equipment({
      pmProc1: null,
      pmTemplateId: null,
      description: "Infusion pump",
    });
    const template: PmTemplateForMatch = {
      id: "tpl-1",
      name: "Infusion pump PM",
      deviceType: "infusion pump",
      aliases: "",
      manufacturer: "",
      model: "",
      version: 4,
      active: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
      steps: [
        {
          id: "step-flow",
          sortOrder: 0,
          text: "Flow rate",
          stepType: "NUMERIC",
          required: true,
          unit: "mL/h",
          minValue: 1,
          maxValue: 999,
        },
      ],
    };
    const data = buildScheduledPmWorkOrderData({
      organizationId: "org-1",
      woNumber: 1043,
      equipment: eq,
      month: "2026-10",
      dateOpened: opened,
      openedById: "user-1",
      assignedTechId: null,
      resolved: resolvePmProcedure(eq, [template]),
    });

    assert.equal(data.pmProcedureSource, "LIBRARY");
    assert.equal(data.pmTemplateId, "tpl-1");
    assert.equal(data.pmTemplateName, "Infusion pump PM");
    assert.equal(data.pmTemplateVersion, 4);
    assert.equal(data.pmProc1, null);
    assert.equal(data.assignedTechId, null);
    const checklist = data.pmChecklist as PmChecklistItem[];
    assert.equal(checklist.length, 1);
    assert.equal(checklist[0]?.text, "Flow rate");
    assert.equal(checklist[0]?.stepType, "NUMERIC");
    assert.equal(checklist[0]?.required, true);
    assert.equal(checklist[0]?.unit, "mL/h");
  });

  it("falls back to the generic step when nothing else matches", () => {
    const eq = equipment({
      pmProc1: "  ",
      description: null,
      manufacturer: null,
      model: null,
      pmTemplateId: null,
    });
    const data = buildScheduledPmWorkOrderData({
      organizationId: "org-1",
      woNumber: 1044,
      equipment: eq,
      month: "2026-10",
      dateOpened: opened,
      openedById: "user-1",
      assignedTechId: null,
      resolved: resolvePmProcedure(
        {
          pmProc1: null,
          description: null,
          manufacturer: null,
          model: null,
          pmTemplateId: null,
        },
        []
      ),
    });
    const checklist = data.pmChecklist as PmChecklistItem[];
    assert.equal(data.pmProcedureSource, "GENERIC");
    assert.equal(checklist.length, 1);
    assert.equal(checklist[0]?.text, GENERIC_PM_STEP_TEXT);
  });
});

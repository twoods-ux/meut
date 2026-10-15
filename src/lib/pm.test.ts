import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPmChecklist,
  checklistFromFormData,
  GENERIC_PM_STEP_TEXT,
  missingRequiredPmSteps,
  normalizePmChecklist,
  parsePmProcedureSteps,
  readingOutOfRange,
  type PmChecklistItem,
} from "./pm";

function item(partial: Partial<PmChecklistItem> & Pick<PmChecklistItem, "id" | "text">): PmChecklistItem {
  return {
    done: false,
    result: null,
    stepType: "TEXT",
    required: false,
    unit: null,
    minValue: null,
    maxValue: null,
    reading: null,
    note: null,
    outOfRange: false,
    templateId: null,
    templateName: null,
    templateVersion: null,
    ...partial,
  };
}

describe("legacy procedure text", () => {
  it("splits lines and numbered lists the way it always has", () => {
    assert.deepEqual(parsePmProcedureSteps("1. Visual\n2. Functional"), [
      "Visual",
      "Functional",
    ]);
    assert.deepEqual(parsePmProcedureSteps("PM-MON"), ["PM-MON"]);
    assert.deepEqual(parsePmProcedureSteps("  "), []);
  });

  it("falls back to one generic text step when the procedure is empty", () => {
    const checklist = buildPmChecklist(null);
    assert.equal(checklist.length, 1);
    assert.equal(checklist[0]?.text, GENERIC_PM_STEP_TEXT);
    assert.equal(checklist[0]?.stepType, "TEXT");
    assert.equal(checklist[0]?.required, false);
  });

  it("keeps a custom code as a single text step", () => {
    const checklist = buildPmChecklist("PM-DEF");
    assert.equal(checklist.length, 1);
    assert.equal(checklist[0]?.text, "PM-DEF");
    assert.equal(checklist[0]?.stepType, "TEXT");
  });
});

describe("normalizePmChecklist", () => {
  it("reads old saved steps that only have id, text, done, and result", () => {
    const items = normalizePmChecklist([
      { id: "1", text: "Visual inspection", done: true, result: "PASS" },
    ]);
    assert.equal(items[0]?.stepType, "TEXT");
    assert.equal(items[0]?.required, false);
    assert.equal(items[0]?.result, "PASS");
    assert.equal(items[0]?.done, true);
    assert.equal(items[0]?.reading, null);
    assert.deepEqual(missingRequiredPmSteps(items), []);
  });

  it("flags a numeric reading outside inclusive limits", () => {
    const items = normalizePmChecklist([
      {
        id: "g",
        text: "Ground",
        stepType: "NUMERIC",
        required: true,
        unit: "Ω",
        maxValue: 0.3,
        reading: 0.31,
      },
    ]);
    assert.equal(items[0]?.outOfRange, true);
    assert.equal(items[0]?.done, true);
    const atLimit = normalizePmChecklist([
      { id: "g", text: "Ground", stepType: "NUMERIC", maxValue: 0.3, reading: 0.3 },
    ]);
    assert.equal(atLimit[0]?.outOfRange, false);
  });
});

describe("checklistFromFormData", () => {
  it("keeps legacy done and pass/fail fields", () => {
    const form = new FormData();
    form.set("checklist_done_1", "true");
    form.set("checklist_result_1", "FAIL");
    const saved = checklistFromFormData(form, [
      item({ id: "1", text: "Look at it", done: false }),
    ]);
    assert.equal(saved[0]?.done, true);
    assert.equal(saved[0]?.result, "FAIL");
  });

  it("stores a reading and recomputes the out-of-range flag", () => {
    const form = new FormData();
    form.set("checklist_reading_leak", "600");
    const saved = checklistFromFormData(form, [
      item({
        id: "leak",
        text: "Leakage",
        stepType: "NUMERIC",
        required: true,
        unit: "µA",
        maxValue: 500,
      }),
    ]);
    assert.equal(saved[0]?.reading, 600);
    assert.equal(saved[0]?.outOfRange, true);
    assert.equal(saved[0]?.done, true);
    assert.deepEqual(missingRequiredPmSteps(saved), []);
  });

  it("reports required steps that are still empty", () => {
    const form = new FormData();
    const saved = checklistFromFormData(form, [
      item({ id: "a", text: "Ground", stepType: "PASS_FAIL", required: true }),
      item({ id: "b", text: "Comment", stepType: "NOTE", required: true }),
    ]);
    const missing = missingRequiredPmSteps(saved);
    assert.equal(missing.length, 2);
    assert.match(missing[0] || "", /Pass or Fail/);
    assert.match(missing[1] || "", /note/);
  });
});

describe("readingOutOfRange", () => {
  it("treats a blank reading as not out of range", () => {
    assert.equal(readingOutOfRange(null, 0, 1), false);
    assert.equal(readingOutOfRange(1, null, null), false);
    assert.equal(readingOutOfRange(-1, 0, null), true);
  });
});

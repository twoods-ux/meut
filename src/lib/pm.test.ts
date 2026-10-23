import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPmChecklist,
  checklistFromFormData,
  checklistHasPmFailure,
  formatPmStepResult,
  GENERIC_PM_STEP_TEXT,
  missingRequiredPmSteps,
  normalizePmChecklist,
  parsePmStepResult,
  pmStepIsFailure,
  pmStepPrintReading,
  pmStepPrintResult,
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

  it("keeps N/A from older and hand-entered spellings and does not flag the step", () => {
    for (const raw of ["NA", "N/A", "n/a", "N.A.", "not applicable"]) {
      const items = normalizePmChecklist([
        {
          id: "g",
          text: "Ground",
          stepType: "NUMERIC",
          required: true,
          maxValue: 0.3,
          reading: 9,
          result: raw,
        },
      ]);
      assert.equal(items[0]?.result, "NA", raw);
      assert.equal(items[0]?.outOfRange, false, raw);
      assert.equal(items[0]?.done, true, raw);
      assert.equal(pmStepIsFailure(items[0]!), false, raw);
      assert.equal(pmStepPrintResult(items[0]!), "N/A", raw);
      assert.equal(pmStepPrintReading(items[0]!), "Reading: N/A", raw);
      assert.deepEqual(missingRequiredPmSteps(items), []);
    }

    const passFail = normalizePmChecklist([
      { id: "1", text: "Visual", stepType: "PASS_FAIL", required: true, result: "N/A" },
    ]);
    assert.equal(passFail[0]?.result, "NA");
    assert.equal(checklistHasPmFailure(passFail), false);

    const unknown = normalizePmChecklist([
      { id: "1", text: "Visual", done: false, result: "MAYBE" },
    ]);
    assert.equal(unknown[0]?.result, null);
    assert.equal(unknown[0]?.done, false);
    assert.equal(parsePmStepResult(""), null);
  });

  it("still treats a real failure or out-of-limit reading as a failure", () => {
    const failed = normalizePmChecklist([
      { id: "1", text: "Visual", stepType: "PASS_FAIL", result: "FAIL" },
      {
        id: "2",
        text: "Leakage",
        stepType: "NUMERIC",
        maxValue: 500,
        reading: 600,
        unit: "µA",
      },
      { id: "3", text: "Skipped", stepType: "PASS_FAIL", result: "NA" },
    ]);
    assert.equal(checklistHasPmFailure(failed), true);
    assert.equal(pmStepIsFailure(failed[2]!), false);
    assert.equal(failed[1]?.outOfRange, true);
    assert.match(pmStepPrintReading(failed[1]!) || "", /OUT OF RANGE/);
    assert.doesNotMatch(pmStepPrintReading(failed[1]!) || "", /N\/A/);
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
      item({
        id: "c",
        text: "Leakage",
        stepType: "NUMERIC",
        required: true,
        maxValue: 500,
      }),
    ]);
    const missing = missingRequiredPmSteps(saved);
    assert.equal(missing.length, 3);
    assert.match(missing[0] || "", /Pass, Fail, or N\/A/);
    assert.match(missing[1] || "", /note/);
    assert.match(missing[2] || "", /reading or N\/A/);
  });

  it("accepts N/A on pass/fail and reading steps without failing the PM", () => {
    const form = new FormData();
    form.set("checklist_result_a", "NA");
    form.set("checklist_result_leak", "N/A");
    form.set("checklist_reading_leak", "900");
    form.set("checklist_result_look", "not applicable");
    const saved = checklistFromFormData(form, [
      item({ id: "a", text: "Ground", stepType: "PASS_FAIL", required: true }),
      item({
        id: "leak",
        text: "Leakage",
        stepType: "NUMERIC",
        required: true,
        unit: "µA",
        maxValue: 500,
      }),
      item({ id: "look", text: "Look at it", stepType: "TEXT", required: true }),
    ]);
    assert.equal(saved[0]?.result, "NA");
    assert.equal(saved[0]?.done, true);
    assert.equal(saved[1]?.result, "NA");
    assert.equal(saved[1]?.reading, null);
    assert.equal(saved[1]?.outOfRange, false);
    assert.equal(saved[1]?.done, true);
    assert.equal(saved[2]?.result, "NA");
    assert.equal(saved[2]?.done, true);
    assert.deepEqual(missingRequiredPmSteps(saved), []);
    assert.equal(checklistHasPmFailure(saved), false);
    assert.equal(pmStepIsFailure(saved[1]!), false);
    assert.equal(pmStepPrintResult(saved[0]!), "N/A");
    assert.equal(pmStepPrintReading(saved[1]!), "Reading: N/A");
    assert.equal(formatPmStepResult("NA"), "N/A");
  });
});

describe("readingOutOfRange", () => {
  it("treats a blank reading as not out of range", () => {
    assert.equal(readingOutOfRange(null, 0, 1), false);
    assert.equal(readingOutOfRange(1, null, null), false);
    assert.equal(readingOutOfRange(-1, 0, null), true);
  });
});

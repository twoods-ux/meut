import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STARTER_PM_PROCEDURES } from "./pm-procedure-catalog";
import {
  bestPmTemplate,
  resolvePmProcedure,
  type PmTemplateForMatch,
} from "./pm-procedures";
import { GENERIC_PM_STEP_TEXT } from "./pm";

function template(
  partial: Partial<PmTemplateForMatch> & Pick<PmTemplateForMatch, "id">
): PmTemplateForMatch {
  return {
    name: partial.id,
    deviceType: "",
    aliases: "",
    manufacturer: "",
    model: "",
    version: 1,
    active: true,
    updatedAt: "2026-01-01T00:00:00.000Z",
    steps: [
      {
        id: `${partial.id}-s1`,
        sortOrder: 0,
        text: `${partial.id} step`,
        stepType: "PASS_FAIL",
        required: true,
        unit: null,
        minValue: null,
        maxValue: null,
      },
    ],
    ...partial,
  };
}

const typeOnly = template({
  id: "type",
  name: "Infusion pump",
  deviceType: "Infusion pump",
  aliases: "IV pump, syringe pump",
});

const manufacturerAndType = template({
  id: "mfr-type",
  name: "BD infusion pump",
  deviceType: "Infusion pump",
  manufacturer: "BD",
  updatedAt: "2026-02-01T00:00:00.000Z",
});

const modelOnly = template({
  id: "model",
  name: "Alaris 8015",
  model: "Alaris 8015",
  updatedAt: "2026-03-01T00:00:00.000Z",
  steps: [
    {
      id: "model-reading",
      sortOrder: 0,
      text: "Ground resistance",
      stepType: "NUMERIC",
      required: true,
      unit: "Ω",
      minValue: null,
      maxValue: 0.3,
    },
  ],
});

const library = [typeOnly, manufacturerAndType, modelOnly];

describe("bestPmTemplate", () => {
  it("prefers model over manufacturer + type over type", () => {
    const equipment = {
      description: "Infusion Pump",
      manufacturer: "BD",
      model: "Alaris 8015",
    };
    assert.equal(bestPmTemplate(equipment, library)?.template.id, "model");

    assert.equal(
      bestPmTemplate({ ...equipment, model: "Other" }, library)?.template.id,
      "mfr-type"
    );

    assert.equal(
      bestPmTemplate(
        { description: "Syringe pump", manufacturer: "Other", model: "X" },
        library
      )?.template.id,
      "type"
    );
  });

  it("does not let a template with no match fields apply to everything", () => {
    const general = template({ id: "general", name: "General electrical safety" });
    assert.equal(
      bestPmTemplate(
        { description: "Patient Monitor", manufacturer: "Philips", model: "MX40" },
        [general, typeOnly]
      ),
      null
    );
  });

  it("ignores inactive templates", () => {
    const inactive = template({
      id: "off",
      model: "Alaris 8015",
      active: false,
    });
    assert.equal(
      bestPmTemplate(
        { description: "Infusion pump", manufacturer: "BD", model: "Alaris 8015" },
        [inactive, typeOnly]
      )?.template.id,
      "type"
    );
  });
});

describe("resolvePmProcedure", () => {
  const equipment = {
    description: "Infusion Pump",
    manufacturer: "BD",
    model: "Alaris 8015",
  };

  it("keeps a custom pmProc1 ahead of a better library match", () => {
    const resolved = resolvePmProcedure(
      { ...equipment, pmProc1: "PM-PUMP" },
      library
    );
    assert.equal(resolved.source, "CUSTOM");
    assert.equal(resolved.items[0]?.text, "PM-PUMP");
    assert.equal(resolved.items[0]?.stepType, "TEXT");
    assert.equal(resolved.templateId, null);
  });

  it("uses the library, including numeric limits, when pmProc1 is empty", () => {
    const resolved = resolvePmProcedure({ ...equipment, pmProc1: "  " }, library);
    assert.equal(resolved.source, "LIBRARY");
    assert.equal(resolved.templateId, "model");
    assert.equal(resolved.reason, "model");
    assert.equal(resolved.items[0]?.stepType, "NUMERIC");
    assert.equal(resolved.items[0]?.maxValue, 0.3);
    assert.equal(resolved.items[0]?.templateVersion, 1);
  });

  it("uses a pin before the automatic match", () => {
    const resolved = resolvePmProcedure(
      { ...equipment, pmProc1: null, pmTemplateId: "type" },
      library
    );
    assert.equal(resolved.templateId, "type");
    assert.equal(resolved.reason, "pinned");
  });

  it("falls back to the generic step when nothing matches", () => {
    const resolved = resolvePmProcedure(
      {
        description: "Anesthesia Machine",
        manufacturer: "GE Healthcare",
        model: "Aisys CS2",
        pmProc1: null,
      },
      library
    );
    assert.equal(resolved.source, "GENERIC");
    assert.equal(resolved.items[0]?.text, GENERIC_PM_STEP_TEXT);
  });
});

describe("starter catalog", () => {
  it("has one editable starter per requested device family", () => {
    const keys = STARTER_PM_PROCEDURES.map((row) => row.seedKey);
    assert.deepEqual(keys, [
      "infusion-pump",
      "defibrillator",
      "patient-monitor",
      "ventilator",
      "ecg",
      "electrosurgical-unit",
      "suction",
      "electrical-safety",
    ]);
    assert.equal(new Set(keys).size, keys.length);
    const safety = STARTER_PM_PROCEDURES.find((row) => row.seedKey === "electrical-safety");
    assert.equal(safety?.deviceType, "");
    for (const row of STARTER_PM_PROCEDURES) {
      assert.ok(row.steps.length >= 4);
      assert.match(row.notes, /Starter template/);
      if (row.seedKey !== "electrical-safety") {
        assert.ok(row.deviceType.trim().length > 0);
      }
    }
  });
});

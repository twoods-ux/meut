import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { equipmentLookupWhere } from "./equipment-lookup";

describe("equipmentLookupWhere", () => {
  it("returns null for a blank query", () => {
    assert.equal(equipmentLookupWhere("org-1", "  "), null);
  });

  it("searches control number, serial, asset, and description with no status cap", () => {
    const where = equipmentLookupWhere("org-1", "210290");
    assert.ok(where);
    assert.equal(where.organizationId, "org-1");
    assert.equal(where.status, undefined);
    const text = (where.AND as { OR: { controlNum?: unknown; serial?: unknown; deviceNum?: unknown; description?: unknown }[] }[])[0];
    const fields = text.OR.map((clause) => Object.keys(clause)[0]);
    assert.deepEqual(fields, ["controlNum", "serial", "deviceNum", "description"]);
  });

  it("keeps an exact control number even when the facility link does not match", () => {
    const where = equipmentLookupWhere("org-1", "210290", {
      id: "hosp-1",
      hospId: "DEMO",
    });
    assert.ok(where);
    const or = where.OR as { AND?: unknown; controlNum?: { equals?: string } }[];
    assert.equal(or.length, 2);
    assert.ok(or[0].AND);
    assert.equal(or[1].controlNum?.equals, "210290");
  });
});

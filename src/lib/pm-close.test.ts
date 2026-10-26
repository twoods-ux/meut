import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PM_CLOSE_TECH_NOT_FOUND,
  PM_CLOSE_TECH_REQUIRED,
  resolvePmCloseTechnician,
} from "./pm-close";

describe("PM close technician", () => {
  it("rejects a close with no technician", async () => {
    const findTech = async () => {
      throw new Error("should not look up an empty technician");
    };
    await assert.rejects(() => resolvePmCloseTechnician("", findTech), {
      message: PM_CLOSE_TECH_REQUIRED,
    });
    await assert.rejects(() => resolvePmCloseTechnician("   ", findTech), {
      message: PM_CLOSE_TECH_REQUIRED,
    });
    await assert.rejects(() => resolvePmCloseTechnician(null, findTech), {
      message: PM_CLOSE_TECH_REQUIRED,
    });
  });

  it("rejects a technician the organization cannot resolve", async () => {
    await assert.rejects(
      () => resolvePmCloseTechnician("tech-x", async () => null),
      { message: PM_CLOSE_TECH_NOT_FOUND }
    );
  });

  it("returns the technician the organization resolved", async () => {
    const tech = await resolvePmCloseTechnician(" tech-1 ", async (id) => {
      assert.equal(id, "tech-1");
      return { id, techId: "T1" };
    });
    assert.deepEqual(tech, { id: "tech-1", techId: "T1" });
  });
});

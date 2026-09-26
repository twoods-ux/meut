import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMaintenanceMode } from "./maintenance";

describe("parseMaintenanceMode", () => {
  it("is off when unset or not an accepted flag", () => {
    assert.equal(parseMaintenanceMode(undefined), false);
    assert.equal(parseMaintenanceMode(""), false);
    assert.equal(parseMaintenanceMode("0"), false);
    assert.equal(parseMaintenanceMode("false"), false);
    assert.equal(parseMaintenanceMode("yes"), false);
    assert.equal(parseMaintenanceMode("on"), false);
  });

  it("is on for 1 or true, ignoring case and surrounding space", () => {
    assert.equal(parseMaintenanceMode("1"), true);
    assert.equal(parseMaintenanceMode("true"), true);
    assert.equal(parseMaintenanceMode("TRUE"), true);
    assert.equal(parseMaintenanceMode(" True "), true);
  });
});

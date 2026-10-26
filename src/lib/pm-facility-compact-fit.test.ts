import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pmCompactFitScale } from "./pm-facility-compact-fit";

describe("pmCompactFitScale", () => {
  it("leaves a sheet alone when it already fits", () => {
    assert.equal(pmCompactFitScale(400, 900), 1);
    assert.equal(pmCompactFitScale(900, 900), 1);
    assert.equal(pmCompactFitScale(901, 900), 1);
  });

  it("shrinks an overflowing sheet to the page", () => {
    const scale = pmCompactFitScale(1800, 900);
    assert.ok(scale < 1);
    assert.ok(1800 * scale <= 900);
  });

  it("ignores empty measurements", () => {
    assert.equal(pmCompactFitScale(0, 900), 1);
    assert.equal(pmCompactFitScale(400, 0), 1);
    assert.equal(pmCompactFitScale(Number.NaN, 900), 1);
  });
});

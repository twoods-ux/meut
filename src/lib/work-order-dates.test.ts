import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDateTimeLocal,
  toDateTimeLocalValue,
  workOrderCloseBeforeOpen,
} from "./utils";

describe("work order dates", () => {
  it("parses and formats a local date-time", () => {
    const opened = parseDateTimeLocal("2024-01-10T08:15");
    assert.ok(opened);
    assert.equal(opened.getFullYear(), 2024);
    assert.equal(opened.getMonth(), 0);
    assert.equal(opened.getDate(), 10);
    assert.equal(opened.getHours(), 8);
    assert.equal(opened.getMinutes(), 15);
    assert.equal(toDateTimeLocalValue(opened), "2024-01-10T08:15");
  });

  it("rejects impossible calendar dates", () => {
    assert.equal(parseDateTimeLocal("2024-02-31T10:00"), null);
    assert.equal(parseDateTimeLocal("not-a-date"), null);
    assert.equal(parseDateTimeLocal(""), null);
  });

  it("allows close equal to open and rejects an earlier close", () => {
    const opened = parseDateTimeLocal("2024-06-15T10:00");
    const same = parseDateTimeLocal("2024-06-15T10:00");
    const later = parseDateTimeLocal("2024-06-15T10:01");
    const earlier = parseDateTimeLocal("2024-06-14T09:00");
    assert.ok(opened && same && later && earlier);
    assert.equal(workOrderCloseBeforeOpen(opened, same), false);
    assert.equal(workOrderCloseBeforeOpen(opened, later), false);
    assert.equal(workOrderCloseBeforeOpen(opened, earlier), true);
    assert.equal(workOrderCloseBeforeOpen(opened, null), false);
  });
});

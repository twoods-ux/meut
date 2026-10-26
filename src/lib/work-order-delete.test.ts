import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bulkPmDeleteConfirmMessage,
  describePmBulkSelection,
  formatBulkPmDeleteResult,
  parseBulkPmDeleteForm,
  partitionPmBulkDelete,
  workOrderDeleteError,
  workOrderDeleteRefusal,
} from "./work-order-delete";

describe("workOrderDeleteRefusal", () => {
  it("allows an open PM or CM and refuses anything else", () => {
    assert.equal(workOrderDeleteRefusal({ type: "PM", status: "OPEN" }), null);
    assert.equal(workOrderDeleteRefusal({ type: "CM", status: "OPEN" }), null);
    assert.equal(workOrderDeleteRefusal(null), "not_found");
    assert.equal(
      workOrderDeleteRefusal({ type: "XX", status: "OPEN" }),
      "wrong_type"
    );
    assert.equal(
      workOrderDeleteRefusal({ type: "PM", status: "CLOSED" }),
      "not_open"
    );
    assert.equal(
      workOrderDeleteRefusal({ type: "PM", status: "CANCELLED" }),
      "not_open"
    );
    assert.equal(
      workOrderDeleteError("not_open"),
      "Only open work orders can be deleted — closed records are kept for history"
    );
    assert.equal(workOrderDeleteError("not_found"), "Work order not found");
    assert.equal(
      workOrderDeleteError("wrong_type"),
      "Only PM or CM work orders can be deleted"
    );
  });

  it("limits the PM list bulk delete to open PM work orders", () => {
    assert.equal(
      workOrderDeleteRefusal({ type: "CM", status: "OPEN" }, ["PM"]),
      "wrong_type"
    );
    assert.equal(
      workOrderDeleteRefusal({ type: "PM", status: "OPEN" }, ["PM"]),
      null
    );
  });
});

describe("partitionPmBulkDelete", () => {
  it("keeps open PMs, counts closed PMs, and sets the rest aside", () => {
    const rows = [
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `open-${i}`,
        type: "PM",
        status: "OPEN",
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `closed-${i}`,
        type: "PM",
        status: "CLOSED",
      })),
      { id: "cancelled", type: "PM", status: "CANCELLED" },
      { id: "cm", type: "CM", status: "OPEN" },
    ];
    const plan = partitionPmBulkDelete(rows);
    assert.equal(plan.deletable.length, 40);
    assert.equal(plan.skippedClosed.length, 3);
    assert.equal(plan.skippedOther.length, 2);
    assert.equal(
      formatBulkPmDeleteResult({
        deleted: plan.deletable.length,
        skippedClosed: plan.skippedClosed.length,
        skippedOther: 0,
      }),
      "Deleted 40, skipped 3 closed"
    );
  });

  it("does not call a closed CM a skipped closed PM", () => {
    const plan = partitionPmBulkDelete([
      { id: "cm-closed", type: "CM", status: "CLOSED" },
    ]);
    assert.equal(plan.skippedClosed.length, 0);
    assert.equal(plan.skippedOther.length, 1);
  });
});

describe("bulk delete copy", () => {
  it("warns with the permanent-delete sentence", () => {
    assert.equal(
      bulkPmDeleteConfirmMessage(12),
      "This will permanently delete 12 selected PM work orders. This cannot be undone."
    );
    assert.equal(
      bulkPmDeleteConfirmMessage(1),
      "This will permanently delete 1 selected PM work order. This cannot be undone."
    );
  });

  it("says when select all covers every open match, including other pages", () => {
    assert.match(
      describePmBulkSelection({
        selectedCount: 250,
        openMatchCount: 250,
        selectingAllMatching: true,
        totalPages: 3,
        narrowedFromAll: false,
      }),
      /250 selected — all open PM work orders matching this filter, including other pages/
    );
    assert.match(
      describePmBulkSelection({
        selectedCount: 4,
        openMatchCount: 250,
        selectingAllMatching: false,
        totalPages: 3,
        narrowedFromAll: false,
      }),
      /4 selected on this page/
    );
    assert.match(
      describePmBulkSelection({
        selectedCount: 248,
        openMatchCount: 250,
        selectingAllMatching: false,
        totalPages: 3,
        narrowedFromAll: true,
      }),
      /248 of 250 open PM work orders matching this filter are selected/
    );
  });
});

describe("parseBulkPmDeleteForm", () => {
  it("requires confirmation and at least one id", () => {
    const missingConfirm = new FormData();
    missingConfirm.set("selection", "ids");
    missingConfirm.append("id", "wo-1");
    assert.equal(parseBulkPmDeleteForm(missingConfirm).ok, false);

    const empty = new FormData();
    empty.set("confirmDelete", "yes");
    empty.set("selection", "ids");
    const emptyResult = parseBulkPmDeleteForm(empty);
    assert.equal(emptyResult.ok, false);
    if (!emptyResult.ok) {
      assert.match(emptyResult.error, /Select at least one/);
    }
  });

  it("reads explicit ids and drops blanks and duplicates", () => {
    const form = new FormData();
    form.set("confirmDelete", "yes");
    form.set("selection", "ids");
    form.append("id", " wo-1 ");
    form.append("id", "wo-1");
    form.append("id", "");
    form.append("id", "wo-2");
    const parsed = parseBulkPmDeleteForm(form);
    assert.equal(parsed.ok, true);
    if (parsed.ok && parsed.request.selection === "ids") {
      assert.deepEqual(parsed.request.ids, ["wo-1", "wo-2"]);
    }
  });

  it("keeps the list filter and ignores page for select-all", () => {
    const form = new FormData();
    form.set("confirmDelete", "yes");
    form.set("selection", "filter");
    form.set("status", "ALL");
    form.set("q", "pump");
    form.set("facility", "hosp-1");
    form.set("pmMonth", "2026-10");
    form.set("pmResult", "PASS");
    form.set("from", "2026-10-01");
    form.set("to", "2026-10-31");
    form.set("tech", "tech-1");
    form.append("excludeId", "wo-9");
    const parsed = parseBulkPmDeleteForm(form);
    assert.equal(parsed.ok, true);
    if (parsed.ok && parsed.request.selection === "filter") {
      assert.equal(parsed.request.filters.status, "ALL");
      assert.equal(parsed.request.filters.q, "pump");
      assert.equal(parsed.request.filters.facilityId, "hosp-1");
      assert.equal(parsed.request.filters.pmMonth, "2026-10");
      assert.equal(parsed.request.filters.pmResult, "PASS");
      assert.equal(parsed.request.filters.page, 1);
      assert.deepEqual(parsed.request.excludeIds, ["wo-9"]);
    }
  });

  it("refuses a filter delete when the status was left off", () => {
    const form = new FormData();
    form.set("confirmDelete", "yes");
    form.set("selection", "filter");
    const parsed = parseBulkPmDeleteForm(form);
    assert.equal(parsed.ok, false);
  });
});

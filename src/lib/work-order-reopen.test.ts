import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bumpPmNextDue } from "./pm";
import {
  canShowReopenWorkOrder,
  equipmentPmDatesAfterReopen,
  passClosePmStamp,
  reopenWorkOrderData,
  shouldApplyPassCloseStamp,
  validateReopenRequest,
} from "./work-order-reopen";

const closedPm = {
  organizationId: "org-1",
  type: "PM",
  status: "CLOSED",
};

describe("reopen visibility", () => {
  it("shows the card only to a supervisor on a closed work order", () => {
    assert.equal(canShowReopenWorkOrder("SUPERVISOR", "CLOSED"), true);
    assert.equal(canShowReopenWorkOrder("TECH", "CLOSED"), false);
    assert.equal(canShowReopenWorkOrder("CUSTOMER", "CLOSED"), false);
    assert.equal(canShowReopenWorkOrder("SUPERVISOR", "OPEN"), false);
    assert.equal(canShowReopenWorkOrder(null, "CLOSED"), false);
  });
});

describe("validateReopenRequest", () => {
  it("accepts a supervisor reopening a closed PM or CM with a reason and confirmation", () => {
    const pm = validateReopenRequest({
      role: "SUPERVISOR",
      sessionOrganizationId: "org-1",
      workOrder: closedPm,
      reason: "  Wrong leakage reading  ",
      confirmed: true,
    });
    assert.deepEqual(pm, { ok: true, reason: "Wrong leakage reading" });

    const cm = validateReopenRequest({
      role: "SUPERVISOR",
      sessionOrganizationId: "org-1",
      workOrder: { ...closedPm, type: "CM" },
      reason: "Parts were not actually replaced",
      confirmed: true,
    });
    assert.equal(cm.ok, true);
  });

  it("rejects techs, customers, other orgs, open orders, and a missing reason or checkbox", () => {
    assert.equal(
      validateReopenRequest({
        role: "TECH",
        sessionOrganizationId: "org-1",
        workOrder: closedPm,
        reason: "Fix",
        confirmed: true,
      }).ok,
      false
    );
    assert.equal(
      validateReopenRequest({
        role: "CUSTOMER",
        sessionOrganizationId: "org-1",
        workOrder: closedPm,
        reason: "Fix",
        confirmed: true,
      }).ok,
      false
    );
    const otherOrg = validateReopenRequest({
      role: "SUPERVISOR",
      sessionOrganizationId: "org-2",
      workOrder: closedPm,
      reason: "Fix",
      confirmed: true,
    });
    assert.equal(otherOrg.ok, false);
    if (!otherOrg.ok) assert.match(otherOrg.error, /not found/);
    const open = validateReopenRequest({
      role: "SUPERVISOR",
      sessionOrganizationId: "org-1",
      workOrder: { ...closedPm, status: "OPEN" },
      reason: "Fix",
      confirmed: true,
    });
    assert.equal(open.ok, false);
    const blank = validateReopenRequest({
      role: "SUPERVISOR",
      sessionOrganizationId: "org-1",
      workOrder: closedPm,
      reason: "   ",
      confirmed: true,
    });
    assert.equal(blank.ok, false);
    const unconfirmed = validateReopenRequest({
      role: "SUPERVISOR",
      sessionOrganizationId: "org-1",
      workOrder: closedPm,
      reason: "Fix",
      confirmed: false,
    });
    assert.equal(unconfirmed.ok, false);
  });
});

describe("reopenWorkOrderData", () => {
  it("clears close result fields and leaves the checklist off the patch", () => {
    const data = reopenWorkOrderData();
    assert.deepEqual(data, {
      status: "OPEN",
      dateClosed: null,
      pmResult: null,
      closedById: null,
    });
    assert.equal("pmChecklist" in data, false);
    assert.equal("workPerformed" in data, false);
    assert.equal("comments" in data, false);
  });
});

describe("equipment PM dates on reopen and re-close", () => {
  const firstClose = new Date(2026, 0, 15, 10, 0, 0);

  it("undoes one interval and recomputes the next close from the new close date", () => {
    const advanced = bumpPmNextDue(firstClose, "Q");
    const afterReopen = equipmentPmDatesAfterReopen({
      type: "PM",
      pmResult: "PASS",
      dateClosed: firstClose,
      schedule: "Q",
      current: { pmLastCompleted: firstClose, pmNextDue: advanced },
      otherPassCloses: [],
    });
    assert.equal(afterReopen.changed, true);
    assert.equal(afterReopen.next.pmLastCompleted, null);
    assert.equal(afterReopen.next.pmNextDue?.getTime(), firstClose.getTime());

    const secondClose = new Date(2026, 0, 16, 11, 0, 0);
    assert.equal(
      shouldApplyPassCloseStamp(secondClose, afterReopen.next.pmLastCompleted),
      true
    );
    const stamp = passClosePmStamp(secondClose, "Q");
    assert.equal(stamp.pmLastCompleted.getTime(), secondClose.getTime());
    assert.equal(
      stamp.pmNextDue.getTime(),
      bumpPmNextDue(secondClose, "Q").getTime()
    );
    assert.notEqual(
      stamp.pmNextDue.getTime(),
      bumpPmNextDue(advanced, "Q").getTime()
    );
  });

  it("restores the latest remaining pass instead of stacking another interval", () => {
    const older = new Date(2025, 9, 15, 10, 0, 0);
    const advanced = bumpPmNextDue(firstClose, "M");
    const restored = equipmentPmDatesAfterReopen({
      type: "PM",
      pmResult: "PASS",
      dateClosed: firstClose,
      schedule: "M",
      current: { pmLastCompleted: firstClose, pmNextDue: advanced },
      otherPassCloses: [{ dateClosed: older, schedule: "M" }],
    });
    assert.equal(restored.next.pmLastCompleted?.getTime(), older.getTime());
    assert.equal(
      restored.next.pmNextDue?.getTime(),
      bumpPmNextDue(older, "M").getTime()
    );
    assert.notEqual(
      restored.next.pmNextDue?.getTime(),
      bumpPmNextDue(advanced, "M").getTime()
    );
  });

  it("leaves a later pass and a fail close untouched", () => {
    const later = new Date(2026, 2, 1, 12, 0, 0);
    const laterNext = bumpPmNextDue(later, "Q");
    const olderReopen = equipmentPmDatesAfterReopen({
      type: "PM",
      pmResult: "PASS",
      dateClosed: firstClose,
      schedule: "M",
      current: { pmLastCompleted: later, pmNextDue: laterNext },
      otherPassCloses: [{ dateClosed: later, schedule: "Q" }],
    });
    assert.equal(olderReopen.changed, false);
    assert.equal(olderReopen.next.pmNextDue?.getTime(), laterNext.getTime());

    const fail = equipmentPmDatesAfterReopen({
      type: "PM",
      pmResult: "FAIL",
      dateClosed: firstClose,
      schedule: "M",
      current: {
        pmLastCompleted: new Date(2025, 11, 1, 9, 0, 0),
        pmNextDue: new Date(2026, 0, 1, 9, 0, 0),
      },
      otherPassCloses: [],
    });
    assert.equal(fail.changed, false);

    assert.equal(
      shouldApplyPassCloseStamp(firstClose, later),
      false
    );
  });

  it("does not undo a next due that was edited after the close", () => {
    const manualNext = new Date(2026, 5, 1, 12, 0, 0);
    const result = equipmentPmDatesAfterReopen({
      type: "PM",
      pmResult: "PASS",
      dateClosed: firstClose,
      schedule: "M",
      current: { pmLastCompleted: firstClose, pmNextDue: manualNext },
      otherPassCloses: [],
    });
    assert.equal(result.next.pmLastCompleted, null);
    assert.equal(result.next.pmNextDue?.getTime(), manualNext.getTime());
  });

  it("does not change equipment dates for a CM reopen", () => {
    const next = bumpPmNextDue(firstClose, "A");
    const result = equipmentPmDatesAfterReopen({
      type: "CM",
      pmResult: null,
      dateClosed: firstClose,
      schedule: null,
      current: { pmLastCompleted: firstClose, pmNextDue: next },
      otherPassCloses: [],
    });
    assert.equal(result.changed, false);
    assert.equal(result.next.pmNextDue?.getTime(), next.getTime());
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  closeTechnicianSignature,
  printedTechName,
} from "./print-signature";

describe("printedTechName", () => {
  it("prints a first initial and last name", () => {
    assert.equal(printedTechName("Travis Woods"), "T. Woods");
    assert.equal(printedTechName("travis woods"), "T. woods");
    assert.equal(
      printedTechName({ firstName: "Travis", lastName: "Woods" }),
      "T. Woods"
    );
    assert.equal(printedTechName("Travis Michael Woods"), "T. Woods");
    assert.equal(printedTechName("Travis Woods Jr."), "T. Woods");
    assert.equal(printedTechName("Woods, Travis"), "T. Woods");
  });

  it("keeps a single name when there is no last name", () => {
    assert.equal(printedTechName("Madonna"), "Madonna");
    assert.equal(
      printedTechName({ firstName: "Travis", lastName: null, name: "Travis" }),
      "Travis"
    );
    assert.equal(
      printedTechName({ firstName: null, lastName: "Woods", name: "" }),
      "Woods"
    );
    assert.equal(printedTechName("   "), null);
    assert.equal(printedTechName(null), null);
  });

  it("uses the display name when the last name field is blank", () => {
    assert.equal(
      printedTechName({
        firstName: "Travis",
        lastName: " ",
        name: "Travis Woods",
      }),
      "T. Woods"
    );
  });
});

describe("closeTechnicianSignature", () => {
  const closedOn = new Date(2026, 9, 26);

  it("leaves an open work order blank", () => {
    assert.equal(
      closeTechnicianSignature({
        status: "OPEN",
        type: "PM",
        dateClosed: closedOn,
        assignedTech: { name: "Travis Woods" },
        closedBy: { name: "Pat Supervisor" },
      }),
      null
    );
  });

  it("uses the PM technician chosen at close", () => {
    assert.deepEqual(
      closeTechnicianSignature({
        status: "CLOSED",
        type: "PM",
        dateClosed: closedOn,
        assignedTech: { firstName: "Travis", lastName: "Woods" },
        closedBy: { name: "Pat Supervisor" },
      }),
      { name: "T. Woods", dateLabel: "Oct 26, 2026" }
    );
  });

  it("uses the CM technician recorded at close", () => {
    assert.deepEqual(
      closeTechnicianSignature({
        status: "CLOSED",
        type: "CM",
        dateClosed: closedOn,
        assignedTech: { name: "Jordan Tech" },
        closedBy: { name: "Pat Supervisor" },
      }),
      { name: "J. Tech", dateLabel: "Oct 26, 2026" }
    );
  });

  it("uses the CM closing user when no technician is recorded", () => {
    assert.deepEqual(
      closeTechnicianSignature({
        status: "CLOSED",
        type: "CM",
        dateClosed: closedOn,
        assignedTech: null,
        closedBy: { firstName: "Travis", lastName: "Woods" },
      }),
      { name: "T. Woods", dateLabel: "Oct 26, 2026" }
    );
    assert.equal(
      closeTechnicianSignature({
        status: "CLOSED",
        type: "CM",
        dateClosed: closedOn,
        assignedTech: { name: "   " },
        closedBy: { name: "Alex Rivera" },
      })?.name,
      "A. Rivera"
    );
  });

  it("still prints the close date when the name cannot be formed", () => {
    assert.deepEqual(
      closeTechnicianSignature({
        status: "CLOSED",
        type: "PM",
        dateClosed: closedOn,
        assignedTech: { name: " " },
      }),
      { name: null, dateLabel: "Oct 26, 2026" }
    );
  });
});

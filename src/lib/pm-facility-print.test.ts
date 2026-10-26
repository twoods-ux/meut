import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FACILITY_PM_DETAIL_PRINT_LIMIT,
  facilityPmDetailPrintWhere,
  facilityPmPrintEndExclusive,
  facilityPmPrintStart,
  parseFacilityPmDetailPrintQuery,
  type FacilityPmDetailPrintParseResult,
} from "./pm-facility-print";

function parseError(result: FacilityPmDetailPrintParseResult): string {
  assert.equal(result.ok, false);
  if (result.ok) return "";
  return result.error;
}

const facility = { id: "hosp-1", hospId: "H100" };

describe("parseFacilityPmDetailPrintQuery", () => {
  it("requires a facility and a month or date range", () => {
    assert.deepEqual(parseFacilityPmDetailPrintQuery({}), {
      ok: false,
      error: "Choose a facility.",
    });
    assert.equal(
      parseError(parseFacilityPmDetailPrintQuery({ facility: "  " })),
      "Choose a facility."
    );
    assert.equal(
      parseError(
        parseFacilityPmDetailPrintQuery({ facility: "ALL", month: "2026-10" })
      ),
      "Choose a facility."
    );
    assert.equal(
      parseError(parseFacilityPmDetailPrintQuery({ facility: "hosp-1" })),
      "Choose a PM month or a date range."
    );
  });

  it("rejects a bad month, bad dates, and a reversed range", () => {
    assert.equal(
      parseError(
        parseFacilityPmDetailPrintQuery({
          facility: "hosp-1",
          month: "2026-13",
        })
      ),
      "PM month must be YYYY-MM."
    );
    assert.equal(
      parseError(
        parseFacilityPmDetailPrintQuery({
          facility: "hosp-1",
          from: "10/01/2026",
        })
      ),
      "Opened from must be a date."
    );
    assert.equal(
      parseError(
        parseFacilityPmDetailPrintQuery({
          facility: "hosp-1",
          to: "yesterday",
        })
      ),
      "Opened to must be a date."
    );
    assert.equal(
      parseError(
        parseFacilityPmDetailPrintQuery({
          facility: "hosp-1",
          from: "2026-10-20",
          to: "2026-10-01",
        })
      ),
      "Opened from is after opened to."
    );
  });

  it("defaults status to completed and accepts all or closed", () => {
    const completed = parseFacilityPmDetailPrintQuery({
      facility: " hosp-1 ",
      month: "2026-10",
    });
    assert.equal(completed.ok, true);
    if (!completed.ok) return;
    assert.deepEqual(completed.query, {
      facilityId: "hosp-1",
      pmMonth: "2026-10",
      from: null,
      to: null,
      status: "completed",
    });

    const closed = parseFacilityPmDetailPrintQuery({
      facility: "hosp-1",
      from: "2026-10-01",
      status: "CLOSED",
    });
    assert.equal(closed.ok && closed.query.status, "completed");

    const all = parseFacilityPmDetailPrintQuery({
      facility: "hosp-1",
      to: "2026-10-31",
      status: " All ",
    });
    assert.equal(all.ok && all.query.status, "all");
    assert.equal(all.ok && all.query.pmMonth, null);

    assert.equal(
      parseError(
        parseFacilityPmDetailPrintQuery({
          facility: "hosp-1",
          month: "2026-10",
          status: "open",
        })
      ),
      "Status must be completed or all."
    );
  });
});

describe("facilityPmDetailPrintWhere", () => {
  it("scopes completed PMs to the org, facility, month, and opened range", () => {
    const parsed = parseFacilityPmDetailPrintQuery({
      facility: "hosp-1",
      month: "2026-10",
      from: "2026-10-01",
      to: "2026-10-31",
      status: "completed",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const where = facilityPmDetailPrintWhere("org-1", facility, parsed.query);
    assert.equal(where.organizationId, "org-1");
    assert.equal(where.type, "PM");
    assert.equal(where.status, "CLOSED");
    assert.equal(where.pmMonth, "2026-10");
    assert.deepEqual(where.equipment, {
      organizationId: "org-1",
      OR: [{ hospitalId: "hosp-1" }, { hospId: "H100" }],
    });
    assert.deepEqual(where.dateOpened, {
      gte: facilityPmPrintStart("2026-10-01"),
      lt: facilityPmPrintEndExclusive("2026-10-31"),
    });
    assert.equal(
      facilityPmPrintEndExclusive("2026-10-31").toISOString(),
      facilityPmPrintStart("2026-11-01").toISOString()
    );
  });

  it("leaves status unset when printing all statuses", () => {
    const parsed = parseFacilityPmDetailPrintQuery({
      facility: "hosp-1",
      month: "2026-01",
      status: "all",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const where = facilityPmDetailPrintWhere("org-1", facility, parsed.query);
    assert.equal(where.status, undefined);
    assert.equal(where.dateOpened, undefined);
    assert.equal(FACILITY_PM_DETAIL_PRINT_LIMIT, 200);
  });
});

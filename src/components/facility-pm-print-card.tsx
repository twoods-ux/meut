import { Printer } from "lucide-react";

export type FacilityPmPrintOption = {
  id: string;
  name: string;
  hospId: string;
};

/**
 * Opens the facility batch print. The PM list and the Reports page share
 * this card so both post to /pm-work-orders/print/facility.
 */
export function FacilityPmPrintCard({
  facilities,
  defaultFacilityId = "",
  defaultMonth,
  defaultFrom = "",
  defaultTo = "",
  idPrefix = "facilityPmPrint",
  className = "",
}: {
  facilities: FacilityPmPrintOption[];
  defaultFacilityId?: string;
  defaultMonth: string;
  defaultFrom?: string;
  defaultTo?: string;
  /** Keeps field ids unique when another form is on the same page. */
  idPrefix?: string;
  className?: string;
}) {
  const facilityId = `${idPrefix}Facility`;
  const monthId = `${idPrefix}Month`;
  const fromId = `${idPrefix}From`;
  const toId = `${idPrefix}To`;
  const statusId = `${idPrefix}Status`;

  return (
    <form
      method="get"
      action="/pm-work-orders/print/facility"
      target="_blank"
      className={`card mb-6 flex flex-wrap items-end gap-3 print:hidden ${className}`}
    >
      <div>
        <label className="label" htmlFor={facilityId}>
          Facility
        </label>
        <select
          className="input"
          id={facilityId}
          name="facility"
          required
          defaultValue={defaultFacilityId}
        >
          <option value="" disabled>
            Select a facility
          </option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.hospId})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={monthId}>
          PM month (YYYY-MM)
        </label>
        <input
          className="input w-40"
          id={monthId}
          name="month"
          defaultValue={defaultMonth}
          pattern="\d{4}-(0[1-9]|1[0-2])"
          placeholder="YYYY-MM"
        />
      </div>
      <div>
        <label className="label" htmlFor={fromId}>
          Opened from
        </label>
        <input
          className="input"
          id={fromId}
          name="from"
          type="date"
          defaultValue={defaultFrom}
        />
      </div>
      <div>
        <label className="label" htmlFor={toId}>
          Opened to
        </label>
        <input
          className="input"
          id={toId}
          name="to"
          type="date"
          defaultValue={defaultTo}
        />
      </div>
      <div>
        <label className="label" htmlFor={statusId}>
          Status
        </label>
        <select
          className="input"
          id={statusId}
          name="status"
          defaultValue="completed"
        >
          <option value="completed">Completed</option>
          <option value="all">All</option>
        </select>
      </div>
      <button type="submit" className="btn-secondary">
        <Printer className="h-4 w-4" /> Print facility PM reports
      </button>
      <p className="w-full text-xs text-slate-500">
        Prints one US Letter page per work order at the selected facility
        (steps, readings, logo, watermark, and reopen history). Choose a
        month, an opened-date range, or both. At most 200 reports are
        included; narrow the range if there are more.
      </p>
    </form>
  );
}

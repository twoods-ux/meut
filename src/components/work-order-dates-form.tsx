import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { updateWorkOrderDates } from "@/lib/actions";
import { toDateTimeLocalValue } from "@/lib/utils";

/**
 * Staff editor for a work order's opened date and, when closed, its closed date.
 * `id` and `hrefBase` must be plain strings — server actions close over them.
 */
export function WorkOrderDatesForm({
  id,
  hrefBase,
  status,
  dateOpened,
  dateClosed,
  openedByName,
  assignedLabel,
  extra,
}: {
  id: string;
  hrefBase: string;
  status: string;
  dateOpened: Date | string;
  dateClosed: Date | string | null;
  openedByName: string | null;
  assignedLabel: string | null;
  extra?: ReactNode;
}) {
  const closed = status === "CLOSED";

  async function action(formData: FormData) {
    "use server";
    const result = await updateWorkOrderDates(id, formData);
    if (!result.ok) {
      redirect(
        `${hrefBase}?dateError=${encodeURIComponent(result.error)}`
      );
    }
    redirect(`${hrefBase}?saved=dates`);
  }

  return (
    <form action={action} className="card space-y-3 text-sm">
      <div>
        <h2 className="font-semibold">Work Order</h2>
        <p className="mt-1 text-xs text-slate-500">
          Correct the opened date
          {closed ? " and the closed date" : ""}. A closed date cannot be
          before the opened date.
        </p>
      </div>
      <div>
        <label className="label" htmlFor={`dateOpened-${id}`}>
          Opened
        </label>
        <input
          id={`dateOpened-${id}`}
          className="input"
          type="datetime-local"
          name="dateOpened"
          required
          step={60}
          defaultValue={toDateTimeLocalValue(dateOpened)}
        />
      </div>
      <p>
        <span className="text-slate-500">Opened by:</span>{" "}
        {openedByName || "—"}
      </p>
      <p>
        <span className="text-slate-500">Assigned:</span>{" "}
        {assignedLabel || "—"}
      </p>
      {closed ? (
        <div>
          <label className="label" htmlFor={`dateClosed-${id}`}>
            Closed
          </label>
          <input
            id={`dateClosed-${id}`}
            className="input"
            type="datetime-local"
            name="dateClosed"
            required
            step={60}
            defaultValue={toDateTimeLocalValue(dateClosed)}
          />
        </div>
      ) : (
        <p>
          <span className="text-slate-500">Closed:</span> —
        </p>
      )}
      {extra}
      <button type="submit" className="btn-secondary">
        Save dates
      </button>
    </form>
  );
}

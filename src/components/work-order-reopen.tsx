import { formatDateTime } from "@/lib/utils";

export type WorkOrderReopenEventView = {
  id: string;
  createdAt: Date;
  reason: string;
  actorName: string | null;
};

export function reopenHistoryFromEvents(
  events: {
    id: string;
    createdAt: Date;
    reason: string;
    actor: { name: string } | null;
  }[]
): WorkOrderReopenEventView[] {
  return events.map((event) => ({
    id: event.id,
    createdAt: event.createdAt,
    reason: event.reason,
    actorName: event.actor?.name || null,
  }));
}

export function ReopenWorkOrderCard({
  action,
  woNumber,
  controlNum,
  type,
  className = "mt-6 max-w-3xl",
}: {
  action: (formData: FormData) => void | Promise<void>;
  woNumber: number;
  controlNum: string;
  type: "PM" | "CM";
  className?: string;
}) {
  const kind = type === "PM" ? "PM" : "CM";
  return (
    <form
      action={action}
      className={`card space-y-3 border border-amber-200 bg-amber-50/60 ${className}`}
    >
      <h2 className="font-semibold text-amber-950">Reopen work order</h2>
      <p className="text-xs text-slate-600">
        {kind === "PM"
          ? "Returns this closed PM to Open so steps and readings can be corrected, then closed again. Checklist answers stay on the work order. A Pass close recomputes last PM and next due from the new close date."
          : "Returns this closed CM to Open so the work performed can be corrected, then closed again."}{" "}
        The reason is kept in the reopen history.
      </p>
      <div>
        <label className="label" htmlFor={`reopen-reason-${woNumber}`}>
          Reason *
        </label>
        <textarea
          id={`reopen-reason-${woNumber}`}
          name="reason"
          className="input"
          rows={3}
          required
          maxLength={2000}
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="confirmReopen"
          value="yes"
          required
          className="mt-1"
        />
        <span>
          I confirm reopening {kind} #{woNumber} (Control # {controlNum})
        </span>
      </label>
      <button type="submit" className="btn-secondary">
        Reopen work order
      </button>
    </form>
  );
}

export function WorkOrderReopenHistory({
  events,
}: {
  events: WorkOrderReopenEventView[];
}) {
  if (events.length === 0) return null;
  return (
    <div className="card mt-6 space-y-3 text-sm">
      <h2 className="font-semibold">Reopen history</h2>
      <ul className="space-y-3">
        {events.map((event) => (
          <li
            key={event.id}
            className="border-t border-slate-100 pt-3 first:border-0 first:pt-0"
          >
            <p className="text-slate-800">
              <span className="font-medium">{event.actorName || "Supervisor"}</span>
              {" · "}
              {formatDateTime(event.createdAt)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-slate-600">{event.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorkOrderReopenHistoryPrint({
  events,
}: {
  events: WorkOrderReopenEventView[];
}) {
  if (events.length === 0) return null;
  return (
    <>
      <h2 className="print-section-title">Reopen history</h2>
      <table className="data-table text-xs">
        <thead>
          <tr>
            <th>When</th>
            <th>Supervisor</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td className="whitespace-nowrap">{formatDateTime(event.createdAt)}</td>
              <td>{event.actorName || "Supervisor"}</td>
              <td className="whitespace-pre-wrap">{event.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

import { bumpPmNextDue } from "./pm";

/** Stored on WorkOrderEvent.type when a supervisor reopens a closed work order. */
export const WORK_ORDER_REOPEN_EVENT = "REOPEN";

export const REOPEN_REASON_MAX = 2000;

export type ReopenDecision =
  | { ok: true; reason: string }
  | { ok: false; error: string };

export type ReopenWorkOrderSnapshot = {
  organizationId: string;
  type: string;
  status: string;
};

/**
 * Staff UI shows the reopen card only for a supervisor looking at a closed
 * work order. Techs and portal customers never see it. The server action
 * repeats this check.
 */
export function canShowReopenWorkOrder(
  role: string | null | undefined,
  status: string
): boolean {
  return role === "SUPERVISOR" && status === "CLOSED";
}

/**
 * Fields written when a closed work order is reopened.
 * Checklist steps, readings, notes, work performed, and labor stay as they are
 * so they can be corrected and the existing close flow can run again.
 */
export function reopenWorkOrderData(): {
  status: "OPEN";
  dateClosed: null;
  pmResult: null;
  closedById: null;
} {
  return {
    status: "OPEN",
    dateClosed: null,
    pmResult: null,
    closedById: null,
  };
}

export function validateReopenRequest(input: {
  role: string | null | undefined;
  sessionOrganizationId: string;
  workOrder: ReopenWorkOrderSnapshot | null;
  reason: string;
  confirmed: boolean;
}): ReopenDecision {
  if (input.role !== "SUPERVISOR") {
    return {
      ok: false,
      error: "Only supervisors can reopen a closed work order",
    };
  }
  if (
    !input.workOrder ||
    input.workOrder.organizationId !== input.sessionOrganizationId
  ) {
    return { ok: false, error: "Work order not found" };
  }
  if (input.workOrder.type !== "PM" && input.workOrder.type !== "CM") {
    return {
      ok: false,
      error: "Only closed PM or CM work orders can be reopened",
    };
  }
  if (input.workOrder.status !== "CLOSED") {
    return { ok: false, error: "Only closed work orders can be reopened" };
  }
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, error: "A reason is required to reopen this work order" };
  }
  if (reason.length > REOPEN_REASON_MAX) {
    return {
      ok: false,
      error: `Reason must be ${REOPEN_REASON_MAX} characters or fewer`,
    };
  }
  if (!input.confirmed) {
    return {
      ok: false,
      error: "Check the confirm box to reopen this work order",
    };
  }
  return { ok: true, reason };
}

export type PmDateStamp = {
  pmLastCompleted: Date | null;
  pmNextDue: Date | null;
};

export type RemainingPassClose = {
  dateClosed: Date;
  schedule: string | null;
};

/** Pass close stamps last completed and next due from the close date, once. */
export function passClosePmStamp(
  dateClosed: Date,
  schedule: string | null | undefined
): { pmLastCompleted: Date; pmNextDue: Date } {
  return {
    pmLastCompleted: dateClosed,
    pmNextDue: bumpPmNextDue(dateClosed, schedule),
  };
}

/**
 * A re-close replaces the equipment stamp from its own close date.
 * It must not move last-completed backward over a later pass, and it must
 * not add another interval on top of a due date that was already bumped.
 */
export function shouldApplyPassCloseStamp(
  dateClosed: Date,
  currentLastCompleted: Date | null | undefined
): boolean {
  if (!currentLastCompleted) return true;
  if (Number.isNaN(currentLastCompleted.getTime())) return true;
  return dateClosed.getTime() >= currentLastCompleted.getTime();
}

function sameInstant(
  a: Date | null | undefined,
  b: Date | null | undefined
): boolean {
  if (!a || !b) return false;
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return a.getTime() === b.getTime();
}

function sameOptionalInstant(
  a: Date | null | undefined,
  b: Date | null | undefined
): boolean {
  if (!a && !b) return true;
  return sameInstant(a, b);
}

/**
 * Undo the equipment PM stamp when this closed Pass is the one currently
 * recorded on the equipment.
 *
 * Next due is rebuilt from the latest remaining Pass close (close date plus
 * one interval). When nothing else has passed, the single interval this close
 * added is removed and next due returns to this close date — it is not bumped
 * again, and a manually edited next due is left alone.
 * Fail closes and older passes do not change the equipment.
 */
export function equipmentPmDatesAfterReopen(input: {
  type: string;
  pmResult: string | null;
  dateClosed: Date | null;
  schedule: string | null;
  current: PmDateStamp;
  otherPassCloses: RemainingPassClose[];
}): { changed: boolean; next: PmDateStamp } {
  const unchanged = { changed: false, next: input.current };
  if (input.type !== "PM" || input.pmResult !== "PASS" || !input.dateClosed) {
    return unchanged;
  }
  if (!sameInstant(input.current.pmLastCompleted, input.dateClosed)) {
    return unchanged;
  }

  const latest = input.otherPassCloses
    .filter(
      (row) => row.dateClosed && !Number.isNaN(row.dateClosed.getTime())
    )
    .sort((a, b) => b.dateClosed.getTime() - a.dateClosed.getTime())[0];

  const stampedNext = bumpPmNextDue(input.dateClosed, input.schedule);
  const nextDueFromThisClose = sameInstant(input.current.pmNextDue, stampedNext);

  const next: PmDateStamp = latest
    ? {
        pmLastCompleted: latest.dateClosed,
        pmNextDue: nextDueFromThisClose
          ? bumpPmNextDue(latest.dateClosed, latest.schedule ?? input.schedule)
          : input.current.pmNextDue,
      }
    : {
        pmLastCompleted: null,
        pmNextDue: nextDueFromThisClose
          ? input.dateClosed
          : input.current.pmNextDue,
      };

  const changed =
    !sameOptionalInstant(input.current.pmLastCompleted, next.pmLastCompleted) ||
    !sameOptionalInstant(input.current.pmNextDue, next.pmNextDue);

  return { changed, next };
}

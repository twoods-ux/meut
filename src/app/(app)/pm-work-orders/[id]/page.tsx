import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import {
  closeWorkOrder,
  savePmChecklist,
  deleteOpenWorkOrder,
  reopenWorkOrder,
} from "@/lib/actions";
import { formatDate, toDateTimeLocalValue } from "@/lib/utils";
import { redirect } from "next/navigation";
import { requireOrgSession } from "@/lib/tenant";
import { Printer } from "lucide-react";
import { resolveRouteParams, oneParam } from "@/lib/route-params";
import { WorkOrderDatesForm } from "@/components/work-order-dates-form";
import { DateTimeField } from "@/components/date-time-field";
import { PmChecklistEditor } from "@/components/pm-checklist";
import { loadMatchTemplates } from "@/lib/pm-procedure-store";
import {
  checklistForWorkOrder,
  procedureSourceLabel,
} from "@/lib/pm-procedures";
import { PmDueBadge } from "@/components/pm-due-badge";
import {
  ReopenWorkOrderCard,
  WorkOrderReopenHistory,
  reopenHistoryFromEvents,
} from "@/components/work-order-reopen";
import { canShowReopenWorkOrder, WORK_ORDER_REOPEN_EVENT } from "@/lib/work-order-reopen";

export const dynamic = "force-dynamic";

export default async function PmDetailPage({
  params,
  searchParams,
}: {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: routeId } = await resolveRouteParams(params);
  const rawSp = searchParams ? await Promise.resolve(searchParams) : {};
  const errorMessage = (oneParam(rawSp.error) || "").trim().slice(0, 300);
  const closeError = (oneParam(rawSp.closeError) || "").trim().slice(0, 300);
  const dateError = (oneParam(rawSp.dateError) || "").trim().slice(0, 300);
  const reopenError = (oneParam(rawSp.reopenError) || "").trim().slice(0, 300);
  const savedDates = oneParam(rawSp.saved) === "dates";
  const reopened = oneParam(rawSp.reopened) === "1";
  const { organizationId, role } = await requireOrgSession();
  const wo = await prisma.workOrder.findFirst({
    where: { id: routeId, organizationId, type: "PM" },
    include: {
      equipment: { include: { hospital: true, department: true } },
      assignedTech: true,
      openedBy: true,
      closedBy: true,
      events: {
        where: { type: WORK_ORDER_REOPEN_EVENT, organizationId },
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true } } },
      },
    },
  });
  if (!wo) notFound();

  const templates = await loadMatchTemplates(prisma, organizationId);
  const checklistView = checklistForWorkOrder({
    status: wo.status,
    pmChecklist: wo.pmChecklist,
    pmProc1: wo.pmProc1,
    equipmentPmProc1: wo.equipment.pmProc1,
    description: wo.equipment.description,
    manufacturer: wo.equipment.manufacturer,
    model: wo.equipment.model,
    pmTemplateId: wo.equipment.pmTemplateId,
    templates,
  });
  const checklist = checklistView.items;
  const sourceLabel = checklistView.fromSnapshot
    ? wo.pmTemplateName
      ? `Saved from ${wo.pmTemplateName}${wo.pmTemplateVersion != null ? ` (v${wo.pmTemplateVersion})` : ""}. Later edits to the library do not change this work order.`
      : wo.pmProcedureSource === "CUSTOM"
        ? "Saved from the equipment procedure."
        : wo.pmProcedureSource === "GENERIC"
          ? "Saved generic step."
          : null
    : checklistView.resolved
      ? procedureSourceLabel(checklistView.resolved)
      : null;

  async function saveChecklistAction(formData: FormData) {
    "use server";
    await savePmChecklist(routeId, formData);
    redirect(`/pm-work-orders/${routeId}`);
  }

  async function closeAction(formData: FormData) {
    "use server";
    try {
      await closeWorkOrder(routeId, formData);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not close work order";
      redirect(
        `/pm-work-orders/${routeId}?closeError=${encodeURIComponent(message.slice(0, 300))}`
      );
    }
    redirect(`/pm-work-orders/${routeId}`);
  }

  async function reopenAction(formData: FormData) {
    "use server";
    const result = await reopenWorkOrder(routeId, formData);
    if (!result.ok) {
      redirect(
        `/pm-work-orders/${routeId}?reopenError=${encodeURIComponent(result.error.slice(0, 300))}`
      );
    }
    redirect(`/pm-work-orders/${routeId}?reopened=1`);
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const confirmed = formData.get("confirmDelete") === "yes";
    if (!confirmed) {
      redirect(
        `/pm-work-orders/${routeId}?error=${encodeURIComponent("Check the confirm box to delete this open PM work order")}`
      );
    }
    const result = await deleteOpenWorkOrder(routeId);
    if (!result.ok) {
      redirect(
        `/pm-work-orders/${routeId}?error=${encodeURIComponent(result.error)}`
      );
    }
    redirect(
      `/pm-work-orders?deleted=${encodeURIComponent(String(result.woNumber))}`
    );
  }

  return (
    <div>
      <PageHeader
        title={`PM Work Order #${wo.woNumber}`}
        subtitle={`${wo.equipment.controlNum} — ${wo.equipment.description || wo.equipment.model || ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/pm-work-orders/${wo.id}/print`} className="btn-primary">
              <Printer className="h-4 w-4" /> Print
            </Link>
            <Link href="/pm-work-orders" className="btn-secondary">
              PM list
            </Link>
            <Link href="/quick-close" className="btn-ghost text-xs">
              Quick Close
            </Link>
          </div>
        }
      />

      {errorMessage ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <p className="font-medium">Could not delete work order</p>
          <p className="mt-1">{errorMessage}</p>
        </div>
      ) : null}
      {closeError ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <p className="font-medium">Could not close work order</p>
          <p className="mt-1">{closeError}</p>
        </div>
      ) : null}
      {dateError ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <p className="font-medium">Could not save dates</p>
          <p className="mt-1">{dateError}</p>
        </div>
      ) : null}
      {savedDates ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <p className="font-medium">Work order dates saved</p>
          <p className="mt-1">
            Lists and reports use these opened and closed dates.
          </p>
        </div>
      ) : null}
      {reopenError ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <p className="font-medium">Could not reopen work order</p>
          <p className="mt-1">{reopenError}</p>
        </div>
      ) : null}
      {reopened ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <p className="font-medium">Work order reopened</p>
          <p className="mt-1">
            Checklist steps are still here. Correct them, then close the PM again.
          </p>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={wo.status} />
        {wo.pmResult ? <StatusBadge status={wo.pmResult} /> : null}
        {wo.pmMonth ? (
          <span className="badge bg-slate-100 text-slate-600">Month {wo.pmMonth}</span>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Equipment</h2>
          <p>
            <span className="text-slate-500">Control #:</span>{" "}
            <Link href={`/equipment/${wo.equipment.id}`} className="link-brand">
              {wo.equipment.controlNum}
            </Link>
          </p>
          <p>
            <span className="text-slate-500">Location:</span>{" "}
            {wo.equipment.location || "—"}
          </p>
          <p>
            <span className="text-slate-500">Facility:</span>{" "}
            {wo.equipment.hospital?.name || "—"}
          </p>
          <p>
            <span className="text-slate-500">Department:</span>{" "}
            {wo.equipment.department?.name || "—"}
          </p>
          <p>
            <span className="text-slate-500">Schedule:</span>{" "}
            {wo.pmSchedule1 || wo.equipment.pmSchedule1 || "—"}
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500">Next due:</span>{" "}
            <PmDueBadge pmNextDue={wo.equipment.pmNextDue} />
          </p>
        </div>
        <WorkOrderDatesForm
          id={wo.id}
          hrefBase={`/pm-work-orders/${wo.id}`}
          status={wo.status}
          dateOpened={wo.dateOpened}
          dateClosed={wo.dateClosed}
          openedByName={wo.openedBy?.name || null}
          assignedLabel={wo.assignedTech?.name || wo.assignedTechCode || null}
          extra={
            wo.pmResult ? (
              <p>
                <span className="text-slate-500">Overall result:</span>{" "}
                <StatusBadge status={wo.pmResult} />
              </p>
            ) : null
          }
        />
      </div>

      <div className="card mb-6">
        <h2 className="mb-2 font-semibold">Work Requested</h2>
        <p className="whitespace-pre-wrap text-sm text-slate-700">
          {wo.workRequested || "—"}
        </p>
      </div>

      {wo.status === "OPEN" ? (
        <form className="card max-w-3xl space-y-6">
          <div>
            <h2 className="font-semibold">PM steps</h2>
            <p className="mb-3 text-xs text-slate-500">
              Pass/fail steps, readings, and notes are saved with this work order.
              Choose N/A when a standard step does not apply to this device. N/A
              counts as answered, is not a failure, and does not flag a reading out
              of limit. A reading outside its limit is flagged. Required steps must
              be filled in before you close. You still choose overall Pass or Fail
              when you close.
            </p>
            <PmChecklistEditor items={checklist} sourceLabel={sourceLabel} />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <h2 className="font-semibold">Close PM Work Order</h2>
            <p className="text-xs text-slate-500">
              A Pass close records last completed and advances next due (by PM
              schedule interval, or +1 month if unset).
            </p>
            <div>
              <label className="label">Overall result *</label>
              <select
                className="input max-w-[200px]"
                name="pmResult"
                defaultValue=""
              >
                <option value="">Select result</option>
                <option value="PASS">Pass</option>
                <option value="FAIL">Fail</option>
              </select>
            </div>
            <div>
              <label className="label">Work Performed</label>
              <textarea
                className="input"
                name="workPerformed"
                rows={3}
                defaultValue={wo.workPerformed || "PM completed per procedure"}
              />
            </div>
            <div>
              <label className="label">Labor Hours</label>
              <input
                className="input max-w-[160px]"
                name="laborHours"
                type="number"
                step="0.25"
                min="0"
                defaultValue={wo.laborHours ?? 0.5}
              />
            </div>
            <div>
              <label className="label">Comments</label>
              <textarea
                className="input"
                name="comments"
                rows={2}
                defaultValue={wo.comments || ""}
              />
            </div>
            <DateTimeField
              id="pm-date-closed"
              name="dateClosed"
              label="Date closed"
              defaultValue={toDateTimeLocalValue(new Date())}
              hint="Defaults to now. Cannot be before the opened date."
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                formAction={saveChecklistAction}
                className="btn-secondary"
              >
                Save steps
              </button>
              <button
                type="submit"
                formAction={closeAction}
                className="btn-primary"
              >
                Close PM
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="card mb-6 space-y-3">
            <h2 className="font-semibold">PM steps</h2>
            <PmChecklistEditor items={checklist} readOnly sourceLabel={sourceLabel} />
          </div>
          <div className="card space-y-2 text-sm">
            <h2 className="font-semibold">Work Performed</h2>
            <p className="whitespace-pre-wrap">{wo.workPerformed || "—"}</p>
            <p>
              <span className="text-slate-500">Labor hours:</span>{" "}
              {wo.laborHours ?? "—"}
            </p>
            <p>
              <span className="text-slate-500">Comments:</span> {wo.comments || "—"}
            </p>
            <p>
              <span className="text-slate-500">Closed by:</span>{" "}
              {wo.closedBy?.name || "—"}
            </p>
            <p>
              <span className="text-slate-500">Date closed:</span>{" "}
              {formatDate(wo.dateClosed)}
            </p>
          </div>
        </>
      )}

      <WorkOrderReopenHistory events={reopenHistoryFromEvents(wo.events)} />

      {canShowReopenWorkOrder(role, wo.status) ? (
        <ReopenWorkOrderCard
          action={reopenAction}
          woNumber={wo.woNumber}
          controlNum={wo.equipment.controlNum}
          type="PM"
        />
      ) : null}

      {wo.status === "OPEN" ? (
        <form
          action={deleteAction}
          className="card mt-6 max-w-3xl space-y-3 border border-red-100 bg-red-50/40"
        >
          <h2 className="font-semibold text-red-900">Delete open PM work order</h2>
          <p className="text-xs text-slate-600">
            Use this if a PM was generated by mistake. The equipment record is not
            deleted. Closed PMs cannot be removed.
            {wo.events.length > 0
              ? " This work order was reopened. Deleting it also removes the reopen history."
              : ""}
          </p>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="confirmDelete"
              value="yes"
              required
              className="mt-1"
            />
            <span>
              I confirm deleting open PM #{wo.woNumber} (Control #{" "}
              {wo.equipment.controlNum})
            </span>
          </label>
          <button
            type="submit"
            className="btn-secondary border-red-200 text-red-800 hover:bg-red-50"
          >
            Delete open PM
          </button>
        </form>
      ) : null}
    </div>
  );
}

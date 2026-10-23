import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { closeWorkOrder, deleteOpenWorkOrder, reopenWorkOrder } from "@/lib/actions";
import { redirect } from "next/navigation";
import { requireOrgSession } from "@/lib/tenant";
import { Printer } from "lucide-react";
import { resolveRouteParams, oneParam } from "@/lib/route-params";
import { WorkOrderDatesForm } from "@/components/work-order-dates-form";
import { DateTimeField } from "@/components/date-time-field";
import { toDateTimeLocalValue } from "@/lib/utils";
import {
  ReopenWorkOrderCard,
  WorkOrderReopenHistory,
  reopenHistoryFromEvents,
} from "@/components/work-order-reopen";
import { canShowReopenWorkOrder, WORK_ORDER_REOPEN_EVENT } from "@/lib/work-order-reopen";

export const dynamic = "force-dynamic";

export default async function CmDetailPage({
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
    where: { id: routeId, organizationId },
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
  if (!wo || wo.type !== "CM") notFound();

  async function closeAction(formData: FormData) {
    "use server";
    try {
      await closeWorkOrder(routeId, formData);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not close work order";
      redirect(
        `/cm-work-orders/${routeId}?closeError=${encodeURIComponent(message.slice(0, 300))}`
      );
    }
    redirect(`/cm-work-orders/${routeId}`);
  }

  async function reopenAction(formData: FormData) {
    "use server";
    const result = await reopenWorkOrder(routeId, formData);
    if (!result.ok) {
      redirect(
        `/cm-work-orders/${routeId}?reopenError=${encodeURIComponent(result.error.slice(0, 300))}`
      );
    }
    redirect(`/cm-work-orders/${routeId}?reopened=1`);
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const confirmed = formData.get("confirmDelete") === "yes";
    if (!confirmed) {
      redirect(
        `/cm-work-orders/${routeId}?error=${encodeURIComponent("Check the confirm box to delete this open CM work order")}`
      );
    }
    const result = await deleteOpenWorkOrder(routeId);
    if (!result.ok) {
      redirect(
        `/cm-work-orders/${routeId}?error=${encodeURIComponent(result.error)}`
      );
    }
    redirect(
      `/cm-work-orders?deleted=${encodeURIComponent(String(result.woNumber))}`
    );
  }

  return (
    <div>
      <PageHeader
        title={`CM Work Order #${wo.woNumber}`}
        subtitle={`${wo.equipment.controlNum} — ${wo.equipment.description || wo.equipment.model || ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/cm-work-orders/${wo.id}/print`}
              className="btn-primary"
            >
              <Printer className="h-4 w-4" /> Print
            </Link>
            <Link href="/cm-work-orders" className="btn-secondary">
              Review Open
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
            Correct the work performed, then close the CM again.
          </p>
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-3">
        <StatusBadge status={wo.status} />
        <span className="badge bg-amber-100 text-amber-800">{wo.priority || "ROUTINE"}</span>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Equipment</h2>
          <p><span className="text-slate-500">Control #:</span>{" "}
            <Link href={`/equipment/${wo.equipment.id}`} className="link-brand">
              {wo.equipment.controlNum}
            </Link>
          </p>
          <p><span className="text-slate-500">Location:</span> {wo.equipment.location || "—"}</p>
          <p><span className="text-slate-500">Hospital:</span> {wo.equipment.hospital?.name || "—"}</p>
          <p><span className="text-slate-500">Department:</span> {wo.equipment.department?.name || "—"}</p>
        </div>
        <WorkOrderDatesForm
          id={wo.id}
          hrefBase={`/cm-work-orders/${wo.id}`}
          status={wo.status}
          dateOpened={wo.dateOpened}
          dateClosed={wo.dateClosed}
          openedByName={wo.openedBy?.name || null}
          assignedLabel={wo.assignedTech?.name || wo.assignedTechCode || null}
        />
      </div>

      <div className="card mb-6">
        <h2 className="mb-2 font-semibold">Work Requested</h2>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{wo.workRequested || "—"}</p>
      </div>

      {wo.status === "OPEN" ? (
        <form action={closeAction} className="card max-w-2xl space-y-4">
          <h2 className="font-semibold">Close CM Work Order</h2>
          <div>
            <label className="label">Work Performed *</label>
            <textarea
              className="input"
              name="workPerformed"
              rows={4}
              required
              defaultValue={wo.workPerformed || ""}
            />
          </div>
          <div>
            <label className="label">Labor Hours *</label>
            <input className="input max-w-[160px]" name="laborHours" type="number" step="0.25" min="0" required defaultValue={wo.laborHours ?? 1} />
          </div>
          <div>
            <label className="label">Comments</label>
            <textarea className="input" name="comments" rows={2} defaultValue={wo.comments || ""} />
          </div>
          <DateTimeField
            id="cm-date-closed"
            name="dateClosed"
            label="Date closed"
            defaultValue={toDateTimeLocalValue(new Date())}
            hint="Defaults to now. Cannot be before the opened date."
          />
          <button type="submit" className="btn-primary">Close Work Order</button>
        </form>
      ) : (
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Work Performed</h2>
          <p className="whitespace-pre-wrap">{wo.workPerformed || "—"}</p>
          <p><span className="text-slate-500">Labor hours:</span> {wo.laborHours ?? "—"}</p>
          <p><span className="text-slate-500">Comments:</span> {wo.comments || "—"}</p>
          <p><span className="text-slate-500">Closed by:</span> {wo.closedBy?.name || "—"}</p>
        </div>
      )}

      <WorkOrderReopenHistory events={reopenHistoryFromEvents(wo.events)} />

      {canShowReopenWorkOrder(role, wo.status) ? (
        <ReopenWorkOrderCard
          action={reopenAction}
          woNumber={wo.woNumber}
          controlNum={wo.equipment.controlNum}
          type="CM"
          className="mt-6 max-w-2xl"
        />
      ) : null}

      {wo.status === "OPEN" ? (
        <form
          action={deleteAction}
          className="card mt-6 max-w-2xl space-y-3 border border-red-100 bg-red-50/40"
        >
          <h2 className="font-semibold text-red-900">Delete open CM work order</h2>
          <p className="text-xs text-slate-600">
            Removes this open CM only. The equipment record is not deleted. Closed
            CMs cannot be removed.
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
              I confirm deleting open CM #{wo.woNumber} (Control #{" "}
              {wo.equipment.controlNum})
            </span>
          </label>
          <button
            type="submit"
            className="btn-secondary border-red-200 text-red-800 hover:bg-red-50"
          >
            Delete open CM
          </button>
        </form>
      ) : null}
    </div>
  );
}

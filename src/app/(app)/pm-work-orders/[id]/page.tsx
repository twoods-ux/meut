import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { closeWorkOrder, savePmChecklist } from "@/lib/actions";
import { formatDate, formatDateTime } from "@/lib/utils";
import { redirect } from "next/navigation";
import { requireOrgSession } from "@/lib/tenant";
import { Printer } from "lucide-react";
import { resolveRouteParams } from "@/lib/route-params";
import { buildPmChecklist, normalizePmChecklist } from "@/lib/pm";
import { PmChecklistEditor } from "@/components/pm-checklist";
import { PmDueBadge } from "@/components/pm-due-badge";

export const dynamic = "force-dynamic";

export default async function PmDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id: routeId } = await resolveRouteParams(params);
  const { organizationId } = await requireOrgSession();
  const wo = await prisma.workOrder.findFirst({
    where: { id: routeId, organizationId, type: "PM" },
    include: {
      equipment: { include: { hospital: true, department: true } },
      assignedTech: true,
      openedBy: true,
      closedBy: true,
    },
  });
  if (!wo) notFound();

  const checklist = (() => {
    const existing = normalizePmChecklist(wo.pmChecklist);
    if (existing.length > 0) return existing;
    if (wo.status === "OPEN") {
      return buildPmChecklist(wo.pmProc1 || wo.equipment.pmProc1);
    }
    return [];
  })();

  async function saveChecklistAction(formData: FormData) {
    "use server";
    await savePmChecklist(routeId, formData);
    redirect(`/pm-work-orders/${routeId}`);
  }

  async function closeAction(formData: FormData) {
    "use server";
    await closeWorkOrder(routeId, formData);
    redirect(`/pm-work-orders/${routeId}`);
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
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Work Order</h2>
          <p>
            <span className="text-slate-500">Opened:</span>{" "}
            {formatDateTime(wo.dateOpened)}
          </p>
          <p>
            <span className="text-slate-500">Opened by:</span>{" "}
            {wo.openedBy?.name || "—"}
          </p>
          <p>
            <span className="text-slate-500">Assigned:</span>{" "}
            {wo.assignedTech?.name || wo.assignedTechCode || "—"}
          </p>
          <p>
            <span className="text-slate-500">Closed:</span>{" "}
            {formatDateTime(wo.dateClosed)}
          </p>
          {wo.pmResult ? (
            <p>
              <span className="text-slate-500">Overall result:</span>{" "}
              <StatusBadge status={wo.pmResult} />
            </p>
          ) : null}
        </div>
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
              Mark each step done (optional pass/fail per step). You still choose
              overall Pass or Fail when you close the work order.
            </p>
            <PmChecklistEditor items={checklist} />
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
                defaultValue="PM completed per procedure"
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
                defaultValue="0.5"
              />
            </div>
            <div>
              <label className="label">Comments</label>
              <textarea className="input" name="comments" rows={2} />
            </div>
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
            <PmChecklistEditor items={checklist} readOnly />
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
    </div>
  );
}

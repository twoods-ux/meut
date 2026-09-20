import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { closeWorkOrder } from "@/lib/actions";
import { formatDateTime } from "@/lib/utils";
import { redirect } from "next/navigation";
import { requireOrgSession } from "@/lib/tenant";
import { Printer } from "lucide-react";
import { resolveRouteParams } from "@/lib/route-params";

export const dynamic = "force-dynamic";

export default async function CmDetailPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const { id: routeId } = await resolveRouteParams(params);
  const { organizationId } = await requireOrgSession();
  const wo = await prisma.workOrder.findFirst({
    where: { id: routeId, organizationId },
    include: {
      equipment: { include: { hospital: true, department: true } },
      assignedTech: true,
      openedBy: true,
      closedBy: true,
    },
  });
  if (!wo || wo.type !== "CM") notFound();

  async function closeAction(formData: FormData) {
    "use server";
    await closeWorkOrder(routeId, formData);
    redirect(`/cm-work-orders/${routeId}`);
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
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Work Order</h2>
          <p><span className="text-slate-500">Opened:</span> {formatDateTime(wo.dateOpened)}</p>
          <p><span className="text-slate-500">Opened by:</span> {wo.openedBy?.name || "—"}</p>
          <p><span className="text-slate-500">Assigned:</span> {wo.assignedTech?.name || wo.assignedTechCode || "—"}</p>
          <p><span className="text-slate-500">Closed:</span> {formatDateTime(wo.dateClosed)}</p>
        </div>
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
            <textarea className="input" name="workPerformed" rows={4} required />
          </div>
          <div>
            <label className="label">Labor Hours *</label>
            <input className="input max-w-[160px]" name="laborHours" type="number" step="0.25" min="0" required defaultValue="1" />
          </div>
          <div>
            <label className="label">Comments</label>
            <textarea className="input" name="comments" rows={2} />
          </div>
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
    </div>
  );
}

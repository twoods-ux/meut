import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import {
  requireCustomerSession,
  resolveCustomerFacility,
  customerFacilityEquipmentWhere,
} from "@/lib/tenant";
import { resolveRouteParams } from "@/lib/route-params";

export const dynamic = "force-dynamic";

export default async function CustomerWorkOrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { created?: string; controlNum?: string };
}) {
  const { id: routeId } = await resolveRouteParams(params);
  const justCreated = searchParams?.created === "1";
  const createdControl =
    searchParams?.controlNum?.trim() || "";
  const { organizationId, hospitalId } = await requireCustomerSession();
  const facility = await resolveCustomerFacility(organizationId, hospitalId);
  if (!facility) notFound();
  const wo = await prisma.workOrder.findFirst({
    where: {
      id: routeId,
      organizationId,
      equipment: customerFacilityEquipmentWhere(organizationId, facility),
    },
    include: {
      equipment: { include: { hospital: true, department: true } },
      assignedTech: true,
      openedBy: true,
      closedBy: true,
    },
  });
  if (!wo) notFound();

  const controlLabel = wo.controlNum || wo.equipment.controlNum;

  return (
    <div>
      {justCreated ? (
        <div
          role="status"
          className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <p className="font-medium">CM request submitted</p>
          <p className="mt-1">
            Work order #{wo.woNumber} opened for Control #{" "}
            {createdControl || controlLabel}.
          </p>
        </div>
      ) : null}
      <PageHeader
        title={`${wo.type} Work Order #${wo.woNumber}`}
        subtitle={`Control # ${wo.equipment.controlNum} · ${wo.equipment.hospital?.name || facility.name}${wo.equipment.description || wo.equipment.model ? ` — ${wo.equipment.description || wo.equipment.model}` : ""}`}
        actions={
          <Link href="/portal/work-orders" className="btn-secondary">
            Back to work orders
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <StatusBadge status={wo.status} />
        <span className="badge bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/15">
          {wo.type}
        </span>
        {wo.priority ? (
          <span className="badge bg-amber-100 text-amber-800">{wo.priority}</span>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Equipment</h2>
          <p>
            <span className="text-slate-500">Control #:</span>{" "}
            <Link
              href={`/portal/inventory/${wo.equipment.id}`}
              className="link-brand"
            >
              {wo.equipment.controlNum}
            </Link>
          </p>
          <p>
            <span className="text-slate-500">Location:</span>{" "}
            {wo.equipment.location || "—"}
          </p>
          <p>
            <span className="text-slate-500">Hospital:</span>{" "}
            {wo.equipment.hospital?.name || "—"}
          </p>
          <p>
            <span className="text-slate-500">Department:</span>{" "}
            {wo.equipment.department?.name || "—"}
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
          {wo.pmMonth ? (
            <p>
              <span className="text-slate-500">PM month:</span> {wo.pmMonth}
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
      </div>
    </div>
  );
}

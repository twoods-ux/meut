import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { PmDueBadge } from "@/components/pm-due-badge";
import { EquipmentForm } from "@/components/equipment-form";
import { DateTimeField } from "@/components/date-time-field";
import { formatDate, toDateTimeLocalValue } from "@/lib/utils";
import { requireOrgSession } from "@/lib/tenant";
import { oneParam, resolveRouteParams, resolveSearchParams } from "@/lib/route-params";
import { loadMatchTemplates } from "@/lib/pm-procedure-store";
import {
  procedureSourceLabel,
  resolvePmProcedure,
} from "@/lib/pm-procedures";
import { clearEquipmentPmTemplatePin } from "@/lib/pm-procedure-actions";
import { generateEquipmentPmWorkOrder } from "@/lib/actions";
import { currentPmMonth, scheduledPmDuplicateWhere } from "@/lib/pm-generate";

export const dynamic = "force-dynamic";

export default async function EquipmentDetailPage({
  params,
  searchParams,
}: {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: routeId } = await resolveRouteParams(params);
  const raw = await resolveSearchParams(searchParams);
  const pmError = (oneParam(raw.pmError) || "").trim().slice(0, 300);
  const pmExistsId = (oneParam(raw.pmExists) || "").trim();
  const { organizationId } = await requireOrgSession();
  const equipment = await prisma.equipment.findFirst({
    where: { id: routeId, organizationId },
    include: {
      hospital: true,
      department: true,
      workOrders: { orderBy: { dateOpened: "desc" }, take: 20 },
    },
  });
  if (!equipment) notFound();
  const equipmentId = equipment.id;
  const defaultMonth = currentPmMonth();
  const openedDefault = toDateTimeLocalValue(new Date());
  const templates = await loadMatchTemplates(prisma, organizationId);
  const procedure = resolvePmProcedure(equipment, templates);
  const [hospitals, departments, monthPm, submittedDuplicate] = await Promise.all([
    prisma.hospital.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, hospId: true },
    }),
    prisma.department.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, costCtr: true, hospitalId: true },
    }),
    prisma.workOrder.findFirst({
      where: scheduledPmDuplicateWhere(organizationId, equipmentId, defaultMonth),
      orderBy: { woNumber: "desc" },
      select: { id: true, woNumber: true, pmMonth: true },
    }),
    pmExistsId
      ? prisma.workOrder.findFirst({
          where: {
            id: pmExistsId,
            organizationId,
            equipmentId,
            type: "PM",
            status: { not: "CANCELLED" },
          },
          select: { id: true, woNumber: true, pmMonth: true },
        })
      : Promise.resolve(null),
  ]);

  async function clearPinAction() {
    "use server";
    await clearEquipmentPmTemplatePin(equipmentId);
  }

  async function generatePmAction(formData: FormData) {
    "use server";
    formData.set("equipmentId", equipmentId);
    const result = await generateEquipmentPmWorkOrder(formData);
    if (result.ok) redirect(`/pm-work-orders/${result.id}`);
    if ("duplicate" in result) {
      redirect(`/equipment/${equipmentId}?pmExists=${encodeURIComponent(result.id)}`);
    }
    redirect(
      `/equipment/${equipmentId}?pmError=${encodeURIComponent(result.error.slice(0, 300))}`
    );
  }

  return (
    <div>
      <PageHeader
        title={`Equipment ${equipment.controlNum}`}
        subtitle={equipment.description || "Equipment Detail"}
        actions={
          <>
            <Link
              href={`/cm-work-orders/new?equipmentId=${equipment.id}`}
              className="btn-primary"
            >
              Open CM Work Order
            </Link>
            <Link href="/equipment" className="btn-secondary">Browse</Link>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <StatusBadge status={equipment.status} />
        {equipment.onPm ? <span className="badge bg-sky-100 text-sky-800">On PM</span> : null}
        {equipment.pmNextDue ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
            <span className="text-slate-400">Next due</span>
            <PmDueBadge pmNextDue={equipment.pmNextDue} />
          </span>
        ) : null}
        {equipment.pmCycleStart ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
            <span className="text-slate-400">PM cycle start</span>
            <span className="font-medium text-slate-700">{formatDate(equipment.pmCycleStart)}</span>
          </span>
        ) : null}
        {equipment.risk ? (
          <span className="badge bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/15">
            Risk {equipment.risk}
          </span>
        ) : null}
        <span className="text-slate-500">
          {equipment.hospital?.name} · {equipment.department?.name || equipment.costCtr || "—"}
        </span>
      </div>
      {submittedDuplicate ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-medium">PM work order already exists</p>
          <p className="mt-1">
            This equipment already has PM #{submittedDuplicate.woNumber}
            {submittedDuplicate.pmMonth ? ` for ${submittedDuplicate.pmMonth}` : ""}.
            No new work order was created.{" "}
            <Link
              href={`/pm-work-orders/${submittedDuplicate.id}`}
              className="link-brand"
            >
              Open WO #{submittedDuplicate.woNumber}
            </Link>
          </p>
        </div>
      ) : null}
      {pmError ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <p className="font-medium">Could not generate PM work order</p>
          <p className="mt-1">{pmError}</p>
        </div>
      ) : null}
      <form
        id="generate-pm"
        action={generatePmAction}
        className="card mb-4 flex flex-wrap items-end gap-3"
      >
        <div>
          <label className="label" htmlFor="equipment-pm-month">
            PM month
          </label>
          <input
            id="equipment-pm-month"
            className="input w-40"
            name="month"
            defaultValue={defaultMonth}
            required
            pattern="\d{4}-(0[1-9]|1[0-2])"
          />
        </div>
        <DateTimeField
          id="equipment-pm-date-opened"
          name="dateOpened"
          label="Date opened"
          defaultValue={openedDefault}
          hint="Defaults to now. Pick any date and time."
        />
        <button type="submit" className="btn-primary">
          Generate PM Work Order
        </button>
        <p className="w-full text-xs text-slate-500">
          Creates one open PM for this equipment, with the same procedure and
          steps as Generate PM WOs. If a PM already exists for that month,
          nothing new is created.
        </p>
        {monthPm && monthPm.id !== submittedDuplicate?.id ? (
          <p className="w-full text-xs text-amber-800">
            PM #{monthPm.woNumber} already exists for {monthPm.pmMonth || defaultMonth}.{" "}
            <Link href={`/pm-work-orders/${monthPm.id}`} className="link-brand">
              Open WO #{monthPm.woNumber}
            </Link>{" "}
            or pick another month.
          </p>
        ) : null}
      </form>
      <div className="card mb-4 text-sm">
        <h2 className="font-semibold">PM procedure for new work orders</h2>
        <p className="mt-1 text-slate-600">{procedureSourceLabel(procedure)}</p>
        {procedure.templateId ? (
          <p className="mt-2">
            <Link href={`/pm-procedures/${procedure.templateId}`} className="link-brand">
              Open procedure
            </Link>
          </p>
        ) : (
          <p className="mt-2">
            <Link href="/pm-procedures" className="link-brand">
              PM procedure library
            </Link>
          </p>
        )}
        {equipment.pmTemplateId ? (
          <form action={clearPinAction} className="mt-3">
            <button type="submit" className="btn-secondary">
              Remove library pin
            </button>
          </form>
        ) : null}
      </div>
      <EquipmentForm
        equipment={{
          id: equipment.id,
          controlNum: equipment.controlNum,
          serial: equipment.serial,
          manufacturer: equipment.manufacturer,
          model: equipment.model,
          description: equipment.description,
          location: equipment.location,
          hospitalId: equipment.hospitalId,
          departmentId: equipment.departmentId,
          status: equipment.status,
          onPm: equipment.onPm,
          pmSchedule1: equipment.pmSchedule1,
          pmProc1: equipment.pmProc1,
          techAssigned1: equipment.techAssigned1,
          pmNextDue: equipment.pmNextDue,
          pmLastCompleted: equipment.pmLastCompleted,
          pmCycleStart: equipment.pmCycleStart,
          comments: equipment.comments,
          risk: equipment.risk,
        }}
        hospitals={hospitals}
        departments={departments}
      />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Maintenance History</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>WO</th>
              <th>Type</th>
              <th>Status</th>
              <th>Opened</th>
              <th>Closed</th>
              <th>Requested</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {equipment.workOrders.map((wo) => (
              <tr key={wo.id}>
                <td>
                  <Link
                    href={wo.type === "CM" ? `/cm-work-orders/${wo.id}` : `/pm-work-orders/${wo.id}`}
                    className="link-brand"
                  >
                    {wo.woNumber}
                  </Link>
                </td>
                <td>{wo.type}</td>
                <td><StatusBadge status={wo.status} /></td>
                <td>{formatDate(wo.dateOpened)}</td>
                <td>{formatDate(wo.dateClosed)}</td>
                <td className="max-w-xs truncate">{wo.workRequested || "—"}</td>
              </tr>
            ))}
            {equipment.workOrders.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-slate-400">No history</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

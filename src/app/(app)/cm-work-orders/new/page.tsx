import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { openCmWorkOrder } from "@/lib/actions";
import { requireOrgSession } from "@/lib/tenant";
import { FacilityEquipmentSelect } from "@/components/facility-equipment-select";
import { DateTimeField } from "@/components/date-time-field";
import { toDateTimeLocalValue } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewCmPage({
  searchParams,
}: {
  searchParams: { equipmentId?: string; facility?: string };
}) {
  const { organizationId } = await requireOrgSession();
  const initialEquipmentId = searchParams.equipmentId || "";
  const [facilities, initialEquipment, techs] = await Promise.all([
    prisma.hospital.findMany({
      where: { organizationId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, hospId: true },
    }),
    initialEquipmentId
      ? prisma.equipment.findFirst({
          where: { id: initialEquipmentId, organizationId },
          select: {
            id: true,
            controlNum: true,
            description: true,
            model: true,
            manufacturer: true,
            serial: true,
            deviceNum: true,
            location: true,
            hospId: true,
          },
        })
      : Promise.resolve(null),
    prisma.user.findMany({
      where: { organizationId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  async function action(formData: FormData) {
    "use server";
    const { id } = await openCmWorkOrder(formData);
    redirect(`/cm-work-orders/${id}`);
  }

  return (
    <div>
      <PageHeader
        title="Open CM Work Order"
        subtitle="Corrective maintenance request"
        actions={<Link href="/cm-work-orders" className="btn-secondary">Back</Link>}
      />
      <form action={action} className="card max-w-2xl space-y-4">
        <FacilityEquipmentSelect
          facilities={facilities}
          initialFacilityId={searchParams.facility || "ALL"}
          initialEquipment={initialEquipment}
        />
        <DateTimeField
          id="cm-date-opened"
          name="dateOpened"
          label="Date opened"
          defaultValue={toDateTimeLocalValue(new Date())}
          hint="Defaults to now. Pick any date and time."
        />
        <div>
          <label className="label">Priority</label>
          <select className="input" name="priority" defaultValue="ROUTINE">
            <option value="STAT">STAT</option>
            <option value="URGENT">Urgent</option>
            <option value="ROUTINE">Routine</option>
          </select>
        </div>
        <div>
          <label className="label">Assign Technician</label>
          <select className="input" name="assignedTechId">
            <option value="">—</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.techId || t.username})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Work Requested *</label>
          <textarea className="input" name="workRequested" rows={4} required />
        </div>
        <button type="submit" className="btn-primary">Save & Open</button>
      </form>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { openCmWorkOrder } from "@/lib/actions";
import { requireOrgSession } from "@/lib/tenant";
import { FacilityEquipmentSelect } from "@/components/facility-equipment-select";

export const dynamic = "force-dynamic";

export default async function NewCmPage({
  searchParams,
}: {
  searchParams: { equipmentId?: string; facility?: string };
}) {
  const { organizationId } = await requireOrgSession();
  const [facilities, equipment, techs] = await Promise.all([
    prisma.hospital.findMany({
      where: { organizationId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, hospId: true },
    }),
    prisma.equipment.findMany({
      where: { organizationId, status: "ACTIVE" },
      orderBy: { controlNum: "asc" },
      take: 1000,
      select: {
        id: true,
        controlNum: true,
        description: true,
        model: true,
        manufacturer: true,
        hospitalId: true,
        hospId: true,
      },
    }),
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
          equipment={equipment}
          initialFacilityId={searchParams.facility || "ALL"}
          initialEquipmentId={searchParams.equipmentId || ""}
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { openCmWorkOrder } from "@/lib/actions";
import { requireOrgSession } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function NewCmPage({
  searchParams,
}: {
  searchParams: { equipmentId?: string };
}) {
  const { organizationId } = await requireOrgSession();
  const [equipment, techs] = await Promise.all([
    prisma.equipment.findMany({
      where: { organizationId, status: "ACTIVE" },
      orderBy: { controlNum: "asc" },
      take: 1000,
    }),
    prisma.user.findMany({
      where: { organizationId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  async function action(formData: FormData) {
    "use server";
    const id = await openCmWorkOrder(formData);
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
        <div>
          <label className="label">Equipment (Control #) *</label>
          <select
            className="input"
            name="equipmentId"
            required
            defaultValue={searchParams.equipmentId || ""}
          >
            <option value="">Select…</option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.controlNum} — {e.description || e.model || e.manufacturer || "equipment"}
              </option>
            ))}
          </select>
        </div>
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

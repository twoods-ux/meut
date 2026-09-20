import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { EquipmentForm } from "@/components/equipment-form";
import { requireOrgSession } from "@/lib/tenant";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewEquipmentPage() {
  const { organizationId } = await requireOrgSession();
  const [hospitals, departments] = await Promise.all([
    prisma.hospital.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader
        title="Add Equipment"
        subtitle="Enter inventory (Equipment Detail)"
        actions={<Link href="/equipment" className="btn-secondary">Back</Link>}
      />
      <EquipmentForm hospitals={hospitals} departments={departments} />
    </div>
  );
}

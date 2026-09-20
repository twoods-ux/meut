import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { requireOrgSession } from "@/lib/tenant";
import { QuickEntryForm } from "@/components/quick-entry-form";

export const dynamic = "force-dynamic";

export default async function QuickEntryPage() {
  const { organizationId } = await requireOrgSession();
  const techs = await prisma.user.findMany({
    where: {
      organizationId,
      active: true,
      role: { in: ["TECH", "SUPERVISOR"] },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, techId: true, username: true },
  });

  return (
    <div>
      <PageHeader
        title="Quick Entry"
        subtitle="Fast-open a corrective (CM) work order by Control # — MediMizer-style"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/quick-close" className="btn-secondary">
              Quick Close
            </Link>
            <Link href="/cm-work-orders" className="btn-secondary">
              CM list
            </Link>
          </div>
        }
      />
      <QuickEntryForm techs={techs} />
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { requireOrgSession } from "@/lib/tenant";
import { QuickCloseForm } from "@/components/quick-close-form";

export const dynamic = "force-dynamic";

export default async function QuickClosePage() {
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
        title="Quick Close"
        subtitle="Find open CM or PM work orders by WO # or Control # and close in one step"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/quick-entry" className="btn-secondary">
              Quick Entry
            </Link>
            <Link href="/cm-work-orders" className="btn-secondary">
              CM list
            </Link>
            <Link href="/pm-work-orders" className="btn-secondary">
              PM list
            </Link>
          </div>
        }
      />
      <QuickCloseForm techs={techs} />
    </div>
  );
}

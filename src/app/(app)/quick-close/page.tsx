import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireOrgSession } from "@/lib/tenant";
import { QuickCloseForm } from "@/components/quick-close-form";

export const dynamic = "force-dynamic";

export default async function QuickClosePage() {
  await requireOrgSession();

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
      <QuickCloseForm />
    </div>
  );
}

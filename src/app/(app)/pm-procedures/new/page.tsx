import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { PmProcedureForm } from "@/components/pm-procedure-form";
import { requireOrgSession } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function NewPmProcedurePage() {
  await requireOrgSession();
  return (
    <div>
      <PageHeader
        title="New PM procedure"
        subtitle="Match on device type, manufacturer, and model. The most specific match is used when a device has no procedure text of its own."
        actions={
          <Link href="/pm-procedures" className="btn-secondary">
            Library
          </Link>
        }
      />
      <PmProcedureForm templateId={null} />
    </div>
  );
}

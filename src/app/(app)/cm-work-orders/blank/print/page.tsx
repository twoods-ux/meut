import { requireOrgSession } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import {
  PrintHeader,
  PrintToolbar,
  PrintField,
  PrintBlock,
} from "@/components/print-header";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Blank CM work order for handwriting / field use. */
export default async function BlankCmWoPrintPage() {
  const { organizationId, organizationName } = await requireOrgSession();
  const orgBrand = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { logoDataUrl: true },
  });
  const printLogoSrc = orgBrand?.logoDataUrl ? "/api/org/logo" : null;
  const org = organizationName || "Organization";

  return (
    <div>
      <PrintToolbar backHref="/cm-work-orders" backLabel="Back to CM list" />
      <article className="print-document">
        <PrintHeader
          organizationName={org}
          logoSrc={printLogoSrc}
          title="CM Work Order (Blank)"
          subtitle="Corrective Maintenance — field form"
        />

        <div className="print-grid-3">
          <PrintField label="WO #" blank />
          <PrintField label="Date opened" blank />
          <PrintField label="Priority" blank />
        </div>

        <h2 className="print-section-title">Facility / Equipment</h2>
        <div className="print-grid-3">
          <PrintField label="Facility / hospital" blank />
          <PrintField label="Department" blank />
          <PrintField label="Cost center" blank />
          <PrintField label="Control #" blank />
          <PrintField label="Description" blank />
          <PrintField label="Location" blank />
          <PrintField label="Manufacturer" blank />
          <PrintField label="Model" blank />
          <PrintField label="Serial #" blank />
        </div>

        <h2 className="print-section-title">Assignment</h2>
        <div className="print-grid-3">
          <PrintField label="Requested by" blank />
          <PrintField label="Assigned tech" blank />
          <PrintField label="Phone / contact" blank />
        </div>

        <PrintBlock label="Work requested" blank blankLines={5} />
        <PrintBlock label="Work performed" blank blankLines={5} />

        <div className="print-grid-3 mt-4">
          <PrintField label="Labor hours" blank />
          <PrintField label="Parts used" blank />
          <PrintField label="Date closed" blank />
        </div>

        <PrintBlock label="Comments" blank blankLines={2} />

        <div className="print-sign-line">
          <div className="line">Technician signature / date</div>
          <div className="line">Requester / supervisor signature</div>
        </div>

        <p className="mt-6 text-[10px] text-slate-400 print:mt-4">
          Blank CM form · {formatDate(new Date())} · M.E.U.T.
        </p>
      </article>
    </div>
  );
}

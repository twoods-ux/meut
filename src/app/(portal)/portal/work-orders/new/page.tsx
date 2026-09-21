import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui";
import { createCustomerCmWorkOrder } from "@/lib/actions";
import { requireCustomerSession } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function CustomerNewCmPage({
  searchParams,
}: {
  searchParams: { equipmentId?: string };
}) {
  const { organizationId, hospitalId } = await requireCustomerSession();

  const [hospital, equipment] = await Promise.all([
    prisma.hospital.findFirst({
      where: { id: hospitalId, organizationId },
    }),
    prisma.equipment.findMany({
      where: { organizationId, hospitalId, status: "ACTIVE" },
      orderBy: { controlNum: "asc" },
      take: 1000,
      select: {
        id: true,
        controlNum: true,
        description: true,
        model: true,
        manufacturer: true,
        location: true,
      },
    }),
  ]);

  async function action(formData: FormData) {
    "use server";
    const { id } = await createCustomerCmWorkOrder(formData);
    redirect(`/portal/work-orders/${id}`);
  }

  return (
    <div>
      <PageHeader
        title="Request CM work order"
        subtitle={`Corrective maintenance for equipment at ${hospital?.name || "your facility"}`}
        actions={
          <Link href="/portal/work-orders" className="btn-secondary">
            Back
          </Link>
        }
      />

      {equipment.length === 0 ? (
        <EmptyState message="No active equipment at your facility to request service for." />
      ) : (
        <form action={action} className="card max-w-2xl space-y-4">
          <div>
            <label className="label" htmlFor="equipmentId">
              Equipment (Control #) *
            </label>
            <select
              className="input"
              id="equipmentId"
              name="equipmentId"
              required
              defaultValue={searchParams.equipmentId || ""}
            >
              <option value="" disabled>
                Select equipment…
              </option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.controlNum}
                  {eq.description || eq.model
                    ? ` — ${eq.description || eq.model}`
                    : ""}
                  {eq.location ? ` (${eq.location})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="priority">
              Priority
            </label>
            <select
              className="input"
              id="priority"
              name="priority"
              defaultValue="ROUTINE"
            >
              <option value="STAT">STAT</option>
              <option value="URGENT">Urgent</option>
              <option value="ROUTINE">Routine</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="workRequested">
              Problem / description *
            </label>
            <textarea
              className="input"
              id="workRequested"
              name="workRequested"
              rows={4}
              required
              placeholder="Describe the issue or request…"
            />
          </div>
          <button type="submit" className="btn-primary">
            Submit CM request
          </button>
        </form>
      )}
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/tenant";
import { PageHeader, EmptyState } from "@/components/ui";
import { ensureStarterPmProcedures } from "@/lib/pm-procedure-store";
import { resolvePmProcedure, type PmTemplateForMatch } from "@/lib/pm-procedures";
import { restoreStarterPmProcedures } from "@/lib/pm-procedure-actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PmProceduresPage({
  searchParams,
}: {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId } = await requireOrgSession();
  await ensureStarterPmProcedures(prisma, organizationId);
  const raw = searchParams ? await Promise.resolve(searchParams) : {};
  const notice = typeof raw.deleted === "string" ? raw.deleted : "";
  const restored = typeof raw.restored === "string" ? raw.restored : "";

  const [templates, equipment, dismissed] = await Promise.all([
    prisma.pmProcedureTemplate.findMany({
      where: { organizationId },
      include: { steps: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.equipment.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: {
        id: true,
        description: true,
        manufacturer: true,
        model: true,
        pmProc1: true,
        pmTemplateId: true,
      },
    }),
    prisma.pmProcedureSeedDismissal.count({ where: { organizationId } }),
  ]);

  const matchTemplates: PmTemplateForMatch[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    deviceType: template.deviceType,
    aliases: template.aliases,
    manufacturer: template.manufacturer,
    model: template.model,
    version: template.version,
    active: template.active,
    updatedAt: template.updatedAt,
    steps: template.steps.map((step) => ({
      id: step.id,
      sortOrder: step.sortOrder,
      text: step.text,
      stepType: step.stepType,
      required: step.required,
      unit: step.unit,
      minValue: step.minValue,
      maxValue: step.maxValue,
    })),
  }));

  const usedBy = new Map<string, number>();
  for (const item of equipment) {
    const resolved = resolvePmProcedure(item, matchTemplates);
    if (resolved.templateId) {
      usedBy.set(resolved.templateId, (usedBy.get(resolved.templateId) || 0) + 1);
    }
  }

  async function restoreAction() {
    "use server";
    const result = await restoreStarterPmProcedures();
    if (!result.ok) {
      redirect(`/pm-procedures?deleted=${encodeURIComponent(result.error)}`);
    }
    redirect(`/pm-procedures?restored=${result.created}`);
  }

  return (
    <div>
      <PageHeader
        title="PM procedure library"
        subtitle="Reusable procedures matched by device type, manufacturer, and model. A device’s own procedure text is still used first."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/pm-procedures/apply" className="btn-secondary">
              Preview matches
            </Link>
            <Link href="/pm-procedures/new" className="btn-primary">
              New procedure
            </Link>
          </div>
        }
      />

      {notice ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
        >
          {notice}
        </div>
      ) : null}
      {restored ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Restored {restored} starter {restored === "1" ? "procedure" : "procedures"}.
        </div>
      ) : null}

      {templates.length === 0 ? (
        <EmptyState
          title="No procedures yet"
          message="Create a procedure or restore the starter set for common hospital devices."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Procedure</th>
                <th>Matches</th>
                <th>Steps</th>
                <th>Version</th>
                <th>Used by</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((template) => {
                const matchBits = [
                  template.deviceType ? template.deviceType : null,
                  template.manufacturer ? template.manufacturer : null,
                  template.model ? template.model : null,
                ].filter(Boolean);
                return (
                  <tr key={template.id}>
                    <td>
                      <Link href={`/pm-procedures/${template.id}`} className="link-brand font-medium">
                        {template.name}
                      </Link>
                      <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-slate-400">
                        {template.seedKey
                          ? template.customized
                            ? "Starter · edited"
                            : "Starter"
                          : "Custom"}
                      </span>
                    </td>
                    <td className="text-sm">
                      {matchBits.length > 0 ? matchBits.join(" · ") : "No auto-match until you set a type, manufacturer, or model"}
                    </td>
                    <td className="tabular-nums">{template.steps.length}</td>
                    <td className="tabular-nums">v{template.version}</td>
                    <td className="tabular-nums">{usedBy.get(template.id) || 0}</td>
                    <td>{template.active ? "Active" : "Inactive"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dismissed > 0 ? (
        <form action={restoreAction} className="mt-6">
          <p className="mb-2 text-sm text-slate-500">
            {dismissed} starter {dismissed === 1 ? "procedure was" : "procedures were"} removed.
            Restoring adds them back and does not change procedures you have edited.
          </p>
          <button type="submit" className="btn-secondary">
            Restore starter procedures
          </button>
        </form>
      ) : null}
    </div>
  );
}

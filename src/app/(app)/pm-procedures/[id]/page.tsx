import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/tenant";
import { resolveRouteParams } from "@/lib/route-params";
import { PageHeader } from "@/components/ui";
import { PmProcedureForm } from "@/components/pm-procedure-form";
import { deletePmProcedureTemplate } from "@/lib/pm-procedure-actions";
import {
  bestPmTemplate,
  resolvePmProcedure,
  type PmTemplateForMatch,
} from "@/lib/pm-procedures";

export const dynamic = "force-dynamic";

export default async function PmProcedureDetailPage({
  params,
  searchParams,
}: {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await resolveRouteParams(params);
  const raw = searchParams ? await Promise.resolve(searchParams) : {};
  const errorMessage = typeof raw.error === "string" ? raw.error : "";
  const { organizationId } = await requireOrgSession();

  const template = await prisma.pmProcedureTemplate.findFirst({
    where: { id, organizationId },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) notFound();

  const [allTemplates, equipment] = await Promise.all([
    prisma.pmProcedureTemplate.findMany({
      where: { organizationId },
      include: { steps: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.equipment.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: {
        id: true,
        controlNum: true,
        description: true,
        manufacturer: true,
        model: true,
        pmProc1: true,
        pmTemplateId: true,
      },
      orderBy: { controlNum: "asc" },
      take: 2000,
    }),
  ]);

  const matchTemplates: PmTemplateForMatch[] = allTemplates.map((row) => ({
    id: row.id,
    name: row.name,
    deviceType: row.deviceType,
    aliases: row.aliases,
    manufacturer: row.manufacturer,
    model: row.model,
    version: row.version,
    active: row.active,
    updatedAt: row.updatedAt,
    steps: row.steps.map((step) => ({
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

  const applies = equipment
    .map((item) => {
      const resolved = resolvePmProcedure(item, matchTemplates);
      const best = bestPmTemplate(item, matchTemplates);
      const wins = resolved.templateId === template.id;
      const bestIsThis = best?.template.id === template.id;
      const pinnedHere = item.pmTemplateId === template.id;
      if (!wins && !bestIsThis && !pinnedHere) return null;
      let why = "Best match, but custom procedure text is used instead";
      if (wins && resolved.reason === "pinned") why = "Pinned on this device";
      else if (wins) why = "Used for new work orders";
      else if (pinnedHere && String(item.pmProc1 || "").trim()) {
        why = "Pinned, but custom procedure text is used instead";
      }
      return { item, why };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  async function deleteAction(formData: FormData) {
    "use server";
    if (formData.get("confirmDelete") !== "yes") {
      redirect(
        `/pm-procedures/${id}?error=${encodeURIComponent("Check the box to delete this procedure")}`
      );
    }
    const result = await deletePmProcedureTemplate(id);
    if (!result.ok) {
      redirect(`/pm-procedures/${id}?error=${encodeURIComponent(result.error)}`);
    }
    redirect(`/pm-procedures?deleted=${encodeURIComponent(`Deleted ${result.name}`)}`);
  }

  return (
    <div>
      <PageHeader
        title={template.name}
        subtitle={`Version ${template.version}${template.customized ? " · edited" : ""}${template.seedKey ? " · starter" : ""}. Updated ${template.updatedAt.toLocaleString()}. Saved work orders keep the steps they were given.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/pm-procedures/apply" className="btn-secondary">
              Preview matches
            </Link>
            <Link href="/pm-procedures" className="btn-secondary">
              Library
            </Link>
          </div>
        }
      />

      {errorMessage ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {errorMessage}
        </div>
      ) : null}

      <PmProcedureForm
        templateId={template.id}
        initial={{
          name: template.name,
          deviceType: template.deviceType,
          aliases: template.aliases,
          manufacturer: template.manufacturer,
          model: template.model,
          notes: template.notes || "",
          active: template.active,
          steps: template.steps.map((step) => ({
            text: step.text,
            stepType: step.stepType,
            required: step.required,
            unit: step.unit,
            minValue: step.minValue,
            maxValue: step.maxValue,
          })),
        }}
      />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Equipment this applies to</h2>
      <p className="mb-3 text-sm text-slate-500">
        Active devices where this procedure is the one a new work order would use,
        or where it is the best match but custom procedure text still wins.
      </p>
      {applies.length === 0 ? (
        <p className="text-sm text-slate-500">
          No active equipment currently matches. Set a device type, manufacturer, or
          model that appears on your inventory, or pin it from the match preview.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Control #</th>
                <th>Description</th>
                <th>Manufacturer / model</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applies.map(({ item, why }) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/equipment/${item.id}`} className="link-brand">
                      {item.controlNum}
                    </Link>
                  </td>
                  <td>{item.description || "—"}</td>
                  <td>
                    {[item.manufacturer, item.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td>{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        action={deleteAction}
        className="card mt-8 space-y-3 border border-red-100 bg-red-50/40"
      >
        <h2 className="font-semibold text-red-900">Delete procedure</h2>
        <p className="text-xs text-slate-600">
          Work orders already saved keep their steps. Equipment pins to this
          procedure are cleared. A removed starter is not recreated on the next
          deploy unless you restore starters from the library.
        </p>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="confirmDelete" value="yes" required className="mt-1" />
          <span>I confirm deleting {template.name}</span>
        </label>
        <button
          type="submit"
          className="btn-secondary border-red-200 text-red-800 hover:bg-red-50"
        >
          Delete procedure
        </button>
      </form>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { ensureStarterPmProcedures, loadMatchTemplates } from "@/lib/pm-procedure-store";
import {
  bestPmTemplate,
  procedureSourceLabel,
  resolvePmProcedure,
} from "@/lib/pm-procedures";
import { PmProcedureApplyForm } from "@/components/pm-procedure-apply-form";

export const dynamic = "force-dynamic";

function one(
  value: string | string[] | undefined
): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export default async function PmProcedureApplyPage({
  searchParams,
}: {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId } = await requireOrgSession();
  await ensureStarterPmProcedures(prisma, organizationId);
  const raw = searchParams ? await Promise.resolve(searchParams) : {};
  const q = one(raw.q).trim();
  const includeRetired = one(raw.retired) === "1";
  const pinned = one(raw.pinned);
  const cleared = one(raw.cleared);
  const skippedCustom = one(raw.skippedCustom);
  const skippedNoMatch = one(raw.skippedNoMatch);

  const templates = await loadMatchTemplates(prisma, organizationId);
  const templateNameById = new Map(templates.map((template) => [template.id, template.name]));
  const equipment = await prisma.equipment.findMany({
    where: {
      organizationId,
      ...(includeRetired ? {} : { status: "ACTIVE" }),
      ...(q
        ? {
            OR: [
              { controlNum: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { manufacturer: { contains: q, mode: "insensitive" } },
              { model: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      controlNum: true,
      description: true,
      manufacturer: true,
      model: true,
      pmProc1: true,
      pmTemplateId: true,
      status: true,
    },
    orderBy: { controlNum: "asc" },
    take: 500,
  });

  const rows = equipment.map((item) => {
    const resolved = resolvePmProcedure(item, templates);
    const best = bestPmTemplate(item, templates);
    return {
      id: item.id,
      controlNum: item.controlNum,
      description: item.description,
      manufacturer: item.manufacturer,
      model: item.model,
      customProcedure: String(item.pmProc1 || "").trim() || null,
      pinnedName: item.pmTemplateId
        ? templateNameById.get(item.pmTemplateId) || "Pinned template"
        : null,
      matchName: best?.template.name || null,
      matchReason: best?.reason || null,
      wouldUse: procedureSourceLabel(resolved),
    };
  });

  return (
    <div>
      <PageHeader
        title="Match PM procedures"
        subtitle="Preview which library procedure a new work order will use. Pinning records that choice on the device. Custom procedure text is left alone unless you explicitly overwrite it."
        actions={
          <Link href="/pm-procedures" className="btn-secondary">
            Library
          </Link>
        }
      />

      {pinned ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Pinned {pinned} {pinned === "1" ? "device" : "devices"}
          {cleared && cleared !== "0" ? ` (${cleared} custom procedures cleared)` : ""}.
          Skipped {skippedCustom || "0"} with custom text
          {skippedNoMatch && skippedNoMatch !== "0"
            ? ` and ${skippedNoMatch} with no library match`
            : ""}
          .
        </div>
      ) : null}

      <form className="card mb-4 flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-[16rem] flex-1">
          <label className="label" htmlFor="pm-match-q">
            Search equipment
          </label>
          <input
            id="pm-match-q"
            className="input"
            name="q"
            defaultValue={q}
            placeholder="Control #, description, manufacturer, model"
          />
        </div>
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="retired" value="1" defaultChecked={includeRetired} />
          Include retired
        </label>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>

      <p className="mb-3 text-xs text-slate-500">
        Showing {rows.length} device{rows.length === 1 ? "" : "s"}
        {rows.length === 500 ? " (first 500 — narrow the search)" : ""}. Devices with
        procedure text keep it. Empty procedure text uses a pin if you set one, otherwise
        the best library match, otherwise the generic step.
      </p>

      <PmProcedureApplyForm rows={rows} />
    </div>
  );
}

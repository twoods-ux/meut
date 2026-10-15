"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireStaffSession } from "./tenant";
import { parseLimit, parseStepType } from "./pm";
import { bestPmTemplate } from "./pm-procedures";
import {
  ensureStarterPmProcedures,
  loadMatchTemplates,
} from "./pm-procedure-store";

export type PmProcedureActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

type StepInput = {
  text: string;
  stepType: "PASS_FAIL" | "NUMERIC" | "NOTE";
  required: boolean;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
};

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function parseSteps(raw: string): { steps: StepInput[] } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    return { error: "Steps could not be read. Reload the page and try again." };
  }
  if (!Array.isArray(parsed)) return { error: "Steps must be a list." };
  if (parsed.length === 0) return { error: "Add at least one step." };
  if (parsed.length > 80) return { error: "A procedure can have at most 80 steps." };

  const steps: StepInput[] = [];
  for (let i = 0; i < parsed.length; i += 1) {
    const row = parsed[i];
    const record = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    const text = clean(record.text, 1000);
    if (!text) return { error: `Step ${i + 1} needs a description.` };
    const stepType = parseStepType(record.stepType);
    if (stepType === "TEXT") {
      return { error: `Step ${i + 1} must be pass/fail, a reading, or a note.` };
    }
    const required = record.required === true;
    let unit: string | null = null;
    let minValue: number | null = null;
    let maxValue: number | null = null;
    if (stepType === "NUMERIC") {
      unit = clean(record.unit, 32) || null;
      const minRaw = record.minValue;
      const maxRaw = record.maxValue;
      if (minRaw != null && String(minRaw).trim() !== "") {
        minValue = parseLimit(minRaw);
        if (minValue == null) return { error: `Step ${i + 1} minimum is not a number.` };
      }
      if (maxRaw != null && String(maxRaw).trim() !== "") {
        maxValue = parseLimit(maxRaw);
        if (maxValue == null) return { error: `Step ${i + 1} maximum is not a number.` };
      }
      if (minValue != null && maxValue != null && minValue > maxValue) {
        return { error: `Step ${i + 1} minimum is greater than its maximum.` };
      }
    }
    steps.push({ text, stepType, required, unit, minValue, maxValue });
  }
  return { steps };
}

function revalidateProcedures(id?: string) {
  revalidatePath("/pm-procedures");
  revalidatePath("/pm-procedures/apply");
  revalidatePath("/pm-procedures/new");
  if (id) revalidatePath(`/pm-procedures/${id}`);
  revalidatePath("/pm-work-orders");
  revalidatePath("/equipment");
}

export async function savePmProcedureTemplate(
  id: string | null,
  formData: FormData
): Promise<PmProcedureActionResult<{ id: string }>> {
  try {
    const { organizationId } = await requireStaffSession();
    const name = clean(formData.get("name"), 160);
    if (!name) return { ok: false, error: "Name is required." };
    const deviceType = clean(formData.get("deviceType"), 120);
    const aliases = clean(formData.get("aliases"), 400);
    const manufacturer = clean(formData.get("manufacturer"), 120);
    const model = clean(formData.get("model"), 120);
    const notes = clean(formData.get("notes"), 4000) || null;
    const active = formData.get("active") === "true" || formData.get("active") === "on";
    const parsed = parseSteps(String(formData.get("stepsJson") || ""));
    if ("error" in parsed) return { ok: false, error: parsed.error };

    const stepCreate = parsed.steps.map((step, index) => ({
      sortOrder: index,
      text: step.text,
      stepType: step.stepType,
      required: step.required,
      unit: step.unit,
      minValue: step.minValue,
      maxValue: step.maxValue,
    }));

    if (!id) {
      const created = await prisma.pmProcedureTemplate.create({
        data: {
          organizationId,
          name,
          deviceType,
          aliases,
          manufacturer,
          model,
          notes,
          active,
          customized: true,
          version: 1,
          steps: { create: stepCreate },
        },
      });
      revalidateProcedures(created.id);
      return { ok: true, id: created.id };
    }

    const existing = await prisma.pmProcedureTemplate.findFirst({
      where: { id, organizationId },
      include: { steps: { orderBy: { sortOrder: "asc" } } },
    });
    if (!existing) return { ok: false, error: "Procedure not found." };

    const sameSteps =
      existing.steps.length === stepCreate.length &&
      existing.steps.every((step, index) => {
        const next = stepCreate[index];
        return (
          step.text === next.text &&
          step.stepType === next.stepType &&
          step.required === next.required &&
          (step.unit ?? null) === next.unit &&
          (step.minValue ?? null) === next.minValue &&
          (step.maxValue ?? null) === next.maxValue
        );
      });
    const sameMeta =
      existing.name === name &&
      existing.deviceType === deviceType &&
      existing.aliases === aliases &&
      existing.manufacturer === manufacturer &&
      existing.model === model &&
      (existing.notes ?? null) === notes &&
      existing.active === active;

    if (sameSteps && sameMeta) return { ok: true, id: existing.id };

    await prisma.$transaction([
      prisma.pmProcedureStep.deleteMany({ where: { templateId: existing.id } }),
      prisma.pmProcedureTemplate.update({
        where: { id: existing.id },
        data: {
          name,
          deviceType,
          aliases,
          manufacturer,
          model,
          notes,
          active,
          customized: true,
          version: existing.version + 1,
          steps: { create: stepCreate },
        },
      }),
    ]);
    revalidateProcedures(existing.id);
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("[pm-procedure] save", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save procedure",
    };
  }
}

export async function deletePmProcedureTemplate(
  id: string
): Promise<PmProcedureActionResult<{ name: string }>> {
  try {
    const { organizationId } = await requireStaffSession();
    const existing = await prisma.pmProcedureTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!existing) return { ok: false, error: "Procedure not found." };
    await prisma.$transaction(async (tx) => {
      if (existing.seedKey) {
        await tx.pmProcedureSeedDismissal.upsert({
          where: {
            organizationId_seedKey: {
              organizationId,
              seedKey: existing.seedKey,
            },
          },
          create: { organizationId, seedKey: existing.seedKey },
          update: {},
        });
      }
      await tx.pmProcedureTemplate.delete({ where: { id: existing.id } });
    });
    revalidateProcedures(id);
    return { ok: true, name: existing.name };
  } catch (error) {
    console.error("[pm-procedure] delete", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not delete procedure",
    };
  }
}

export async function restoreStarterPmProcedures(): Promise<
  PmProcedureActionResult<{ created: number }>
> {
  try {
    const { organizationId } = await requireStaffSession();
    await prisma.pmProcedureSeedDismissal.deleteMany({ where: { organizationId } });
    const summary = await ensureStarterPmProcedures(prisma, organizationId);
    revalidateProcedures();
    return { ok: true, created: summary.created };
  } catch (error) {
    console.error("[pm-procedure] restore", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not restore starters",
    };
  }
}

export async function applyPmProcedureMatches(
  formData: FormData
): Promise<
  PmProcedureActionResult<{
    pinned: number;
    clearedCustom: number;
    skippedCustom: number;
    skippedNoMatch: number;
  }>
> {
  try {
    const { organizationId } = await requireStaffSession();
    const ids = Array.from(
      new Set(
        formData
          .getAll("equipmentId")
          .map((value) => String(value).trim())
          .filter(Boolean)
      )
    );
    if (ids.length === 0) {
      return { ok: false, error: "Select at least one device." };
    }
    if (ids.length > 500) {
      return { ok: false, error: "Select 500 or fewer devices at a time." };
    }
    const overwrite = formData.get("overwriteCustom") === "yes";
    const templates = await loadMatchTemplates(prisma, organizationId);
    const equipment = await prisma.equipment.findMany({
      where: { organizationId, id: { in: ids } },
      select: {
        id: true,
        pmProc1: true,
        pmTemplateId: true,
        description: true,
        manufacturer: true,
        model: true,
      },
    });

    let pinned = 0;
    let clearedCustom = 0;
    let skippedCustom = 0;
    let skippedNoMatch = 0;

    for (const item of equipment) {
      const hasCustom = String(item.pmProc1 || "").trim().length > 0;
      if (hasCustom && !overwrite) {
        skippedCustom += 1;
        continue;
      }
      const match = bestPmTemplate(
        {
          description: item.description,
          manufacturer: item.manufacturer,
          model: item.model,
        },
        templates
      );
      if (!match) {
        skippedNoMatch += 1;
        continue;
      }
      await prisma.equipment.update({
        where: { id: item.id },
        data: {
          pmTemplateId: match.template.id,
          ...(hasCustom ? { pmProc1: null } : {}),
        },
      });
      pinned += 1;
      if (hasCustom) clearedCustom += 1;
    }

    revalidatePath("/pm-procedures/apply");
    revalidatePath("/equipment");
    revalidatePath("/pm-work-orders");
    return { ok: true, pinned, clearedCustom, skippedCustom, skippedNoMatch };
  } catch (error) {
    console.error("[pm-procedure] apply", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not apply matches",
    };
  }
}

export async function clearEquipmentPmTemplatePin(
  equipmentId: string
): Promise<PmProcedureActionResult<{ id: string }>> {
  try {
    const { organizationId } = await requireStaffSession();
    const existing = await prisma.equipment.findFirst({
      where: { id: equipmentId, organizationId },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Equipment not found." };
    await prisma.equipment.update({
      where: { id: existing.id },
      data: { pmTemplateId: null },
    });
    revalidatePath(`/equipment/${existing.id}`);
    revalidatePath("/pm-procedures/apply");
    revalidatePath("/pm-work-orders");
    return { ok: true, id: existing.id };
  } catch (error) {
    console.error("[pm-procedure] clear pin", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not remove the pin",
    };
  }
}

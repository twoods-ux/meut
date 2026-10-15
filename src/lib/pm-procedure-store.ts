import { Prisma, PrismaClient } from "@prisma/client";
import { STARTER_PM_PROCEDURES, type StarterPmProcedure } from "./pm-procedure-catalog";
import type { PmTemplateForMatch } from "./pm-procedures";

export type PmSeedSummary = {
  created: number;
  refreshed: number;
  skipped: number;
};

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

type StepSignature = {
  text: string;
  stepType: string;
  required: boolean;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
};

function stepSignature(step: StepSignature): StepSignature {
  return {
    text: step.text,
    stepType: step.stepType,
    required: step.required,
    unit: step.unit ?? null,
    minValue: step.minValue ?? null,
    maxValue: step.maxValue ?? null,
  };
}

function starterSignature(starter: StarterPmProcedure) {
  return JSON.stringify({
    name: starter.name,
    deviceType: starter.deviceType,
    aliases: starter.aliases,
    manufacturer: starter.manufacturer,
    model: starter.model,
    notes: starter.notes,
    steps: starter.steps.map((step) =>
      stepSignature({
        text: step.text,
        stepType: step.stepType,
        required: step.required,
        unit: step.unit ?? null,
        minValue: step.minValue ?? null,
        maxValue: step.maxValue ?? null,
      })
    ),
  });
}

function rowSignature(row: {
  name: string;
  deviceType: string;
  aliases: string;
  manufacturer: string;
  model: string;
  notes: string | null;
  steps: Array<StepSignature & { sortOrder: number }>;
}) {
  const steps = [...row.steps].sort((a, b) => a.sortOrder - b.sortOrder);
  return JSON.stringify({
    name: row.name,
    deviceType: row.deviceType,
    aliases: row.aliases,
    manufacturer: row.manufacturer,
    model: row.model,
    notes: row.notes ?? "",
    steps: steps.map((step) => stepSignature(step)),
  });
}

function starterCreateData(organizationId: string, starter: StarterPmProcedure) {
  return {
    organizationId,
    name: starter.name,
    deviceType: starter.deviceType,
    aliases: starter.aliases,
    manufacturer: starter.manufacturer,
    model: starter.model,
    notes: starter.notes,
    seedKey: starter.seedKey,
    version: 1,
    active: true,
    customized: false,
    steps: {
      create: starter.steps.map((step, index) => ({
        sortOrder: index,
        text: step.text,
        stepType: step.stepType,
        required: step.required,
        unit: step.unit ?? null,
        minValue: step.minValue ?? null,
        maxValue: step.maxValue ?? null,
      })),
    },
  };
}

/**
 * Insert missing starter templates for one organization.
 * Never deletes templates, equipment, or work orders.
 * Skips rows staff have edited (customized) and seed keys they dismissed.
 * Refreshes an unedited starter only when its definition changed, and bumps version.
 */
export async function ensureStarterPmProcedures(
  db: PrismaClient,
  organizationId: string
): Promise<PmSeedSummary> {
  const summary: PmSeedSummary = { created: 0, refreshed: 0, skipped: 0 };
  const dismissed = await db.pmProcedureSeedDismissal.findMany({
    where: { organizationId },
    select: { seedKey: true },
  });
  const dismissedKeys = new Set(dismissed.map((row) => row.seedKey));

  for (const starter of STARTER_PM_PROCEDURES) {
    if (dismissedKeys.has(starter.seedKey)) {
      summary.skipped += 1;
      continue;
    }

    const existing = await db.pmProcedureTemplate.findUnique({
      where: {
        organizationId_seedKey: {
          organizationId,
          seedKey: starter.seedKey,
        },
      },
      include: { steps: true },
    });

    if (!existing) {
      try {
        await db.pmProcedureTemplate.create({
          data: starterCreateData(organizationId, starter),
        });
        summary.created += 1;
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
        summary.skipped += 1;
      }
      continue;
    }

    if (existing.customized) {
      summary.skipped += 1;
      continue;
    }

    if (rowSignature(existing) === starterSignature(starter)) {
      summary.skipped += 1;
      continue;
    }

    await db.$transaction([
      db.pmProcedureStep.deleteMany({ where: { templateId: existing.id } }),
      db.pmProcedureTemplate.update({
        where: { id: existing.id },
        data: {
          name: starter.name,
          deviceType: starter.deviceType,
          aliases: starter.aliases,
          manufacturer: starter.manufacturer,
          model: starter.model,
          notes: starter.notes,
          version: existing.version + 1,
          steps: {
            create: starter.steps.map((step, index) => ({
              sortOrder: index,
              text: step.text,
              stepType: step.stepType,
              required: step.required,
              unit: step.unit ?? null,
              minValue: step.minValue ?? null,
              maxValue: step.maxValue ?? null,
            })),
          },
        },
      }),
    ]);
    summary.refreshed += 1;
  }

  return summary;
}

export async function ensureStarterPmProceduresForAll(db: PrismaClient): Promise<
  PmSeedSummary & { organizations: number }
> {
  const orgs = await db.organization.findMany({ select: { id: true } });
  const total: PmSeedSummary & { organizations: number } = {
    organizations: orgs.length,
    created: 0,
    refreshed: 0,
    skipped: 0,
  };
  for (const org of orgs) {
    const summary = await ensureStarterPmProcedures(db, org.id);
    total.created += summary.created;
    total.refreshed += summary.refreshed;
    total.skipped += summary.skipped;
  }
  return total;
}

export async function loadMatchTemplates(
  db: PrismaClient,
  organizationId: string
): Promise<PmTemplateForMatch[]> {
  const rows = await db.pmProcedureTemplate.findMany({
    where: { organizationId },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
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
}

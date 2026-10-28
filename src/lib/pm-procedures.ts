/**
 * PM procedure library matching.
 *
 * A new work order uses, in order:
 * 1. The equipment's own pmProc1 text when it has any steps (unchanged behavior).
 * 2. A pinned library template, when pmProc1 is empty.
 * 3. The most specific active library template.
 * 4. The existing single generic step.
 *
 * Specificity: model > manufacturer + device type > device type.
 * A model match is worth more than manufacturer + type even when the model
 * template does not also name the manufacturer.
 */

import {
  buildPmChecklist,
  emptyChecklistFields,
  GENERIC_PM_STEP_TEXT,
  normalizePmChecklist,
  parseStepType,
  type PmChecklistItem,
  type PmStepType,
} from "./pm";

export type PmTemplateStep = {
  id: string;
  sortOrder: number;
  text: string;
  stepType: string;
  required: boolean;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
};

export type PmTemplateForMatch = {
  id: string;
  name: string;
  deviceType: string;
  aliases: string;
  manufacturer: string;
  model: string;
  version: number;
  active: boolean;
  updatedAt: Date | string;
  steps: PmTemplateStep[];
};

export type EquipmentProcedureInput = {
  pmProc1?: string | null;
  description?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  pmTemplateId?: string | null;
};

export type PmProcedureSource = "CUSTOM" | "LIBRARY" | "GENERIC";

export type ResolvedPmProcedure = {
  items: PmChecklistItem[];
  source: PmProcedureSource;
  templateId: string | null;
  templateName: string | null;
  templateVersion: number | null;
  /** Short reason such as "model" or "pinned". Null for custom text and the generic step. */
  reason: string | null;
};

const SCORE_MODEL = 1000;
const SCORE_MANUFACTURER = 100;
const SCORE_TYPE = 10;

export function normalizeMatchText(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** True when needle is the whole haystack or a consecutive token phrase inside it. */
export function matchPhrase(
  haystack: string | null | undefined,
  needle: string | null | undefined
): boolean {
  const h = normalizeMatchText(haystack);
  const n = normalizeMatchText(needle);
  if (!h || !n) return false;
  if (h === n) return true;
  return ` ${h} `.includes(` ${n} `);
}

export function deviceTypeLabels(template: {
  deviceType?: string | null;
  aliases?: string | null;
}): string[] {
  const raw = [template.deviceType || "", ...(template.aliases || "").split(",")];
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const part of raw) {
    const label = normalizeMatchText(part);
    if (label.length < 3 || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

function typeMatches(
  description: string | null | undefined,
  template: PmTemplateForMatch
): { matched: boolean; length: number } {
  const labels = deviceTypeLabels(template);
  if (labels.length === 0) return { matched: true, length: 0 };
  const descriptionNorm = normalizeMatchText(description);
  if (!descriptionNorm) return { matched: false, length: 0 };
  let length = 0;
  for (const label of labels) {
    const hit =
      descriptionNorm === label || ` ${descriptionNorm} `.includes(` ${label} `);
    if (hit && label.length > length) length = label.length;
  }
  return { matched: length > 0, length };
}

function manufacturerMatches(
  equipmentManufacturer: string | null | undefined,
  templateManufacturer: string | null | undefined
): boolean {
  const wanted = normalizeMatchText(templateManufacturer);
  if (!wanted) return true;
  return (
    matchPhrase(equipmentManufacturer, wanted) ||
    matchPhrase(wanted, equipmentManufacturer)
  );
}

function modelMatches(
  equipmentModel: string | null | undefined,
  templateModel: string | null | undefined
): boolean {
  const wanted = normalizeMatchText(templateModel);
  if (!wanted) return true;
  const have = normalizeMatchText(equipmentModel);
  if (!have) return false;
  if (have === wanted) return true;
  if (wanted.length < 2) return false;
  return ` ${have} `.includes(` ${wanted} `);
}

export type TemplateMatchScore = {
  template: PmTemplateForMatch;
  score: number;
  reason: string;
  typeLength: number;
};

export function scorePmTemplate(
  equipment: EquipmentProcedureInput,
  template: PmTemplateForMatch
): TemplateMatchScore | null {
  if (!template.active) return null;

  const hasModel = normalizeMatchText(template.model).length > 0;
  const hasManufacturer = normalizeMatchText(template.manufacturer).length > 0;
  const labels = deviceTypeLabels(template);
  const hasType = labels.length > 0;

  let score = 0;
  const parts: string[] = [];

  if (hasModel) {
    if (!modelMatches(equipment.model, template.model)) return null;
    score += SCORE_MODEL;
    parts.push("model");
  }
  if (hasManufacturer) {
    if (!manufacturerMatches(equipment.manufacturer, template.manufacturer)) {
      return null;
    }
    score += SCORE_MANUFACTURER;
    parts.push("manufacturer");
  }
  const typeHit = typeMatches(equipment.description, template);
  if (hasType) {
    if (!typeHit.matched) return null;
    score += SCORE_TYPE;
    parts.push("type");
  }
  if (score === 0) return null;

  return {
    template,
    score,
    reason: parts.join("+"),
    typeLength: typeHit.length,
  };
}

export function bestPmTemplate(
  equipment: EquipmentProcedureInput,
  templates: PmTemplateForMatch[]
): TemplateMatchScore | null {
  const scored = templates
    .map((template) => scorePmTemplate(equipment, template))
    .filter((row): row is TemplateMatchScore => row != null);
  if (scored.length === 0) return null;
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.typeLength !== a.typeLength) return b.typeLength - a.typeLength;
    const bTime = new Date(b.template.updatedAt).getTime();
    const aTime = new Date(a.template.updatedAt).getTime();
    if (bTime !== aTime) return bTime - aTime;
    return a.template.name.localeCompare(b.template.name);
  });
  return scored[0];
}

export function checklistFromTemplate(
  template: PmTemplateForMatch
): PmChecklistItem[] {
  const steps = [...template.steps].sort((a, b) => a.sortOrder - b.sortOrder);
  if (steps.length === 0) {
    return buildPmChecklist(null);
  }
  return steps.map((step, index) => {
    const stepType: PmStepType =
      parseStepType(step.stepType) === "TEXT"
        ? "PASS_FAIL"
        : parseStepType(step.stepType);
    return emptyChecklistFields({
      id: step.id || String(index + 1),
      text: step.text.trim() || `Step ${index + 1}`,
      stepType,
      required: step.required,
      unit: stepType === "NUMERIC" ? step.unit : null,
      minValue: stepType === "NUMERIC" ? step.minValue : null,
      maxValue: stepType === "NUMERIC" ? step.maxValue : null,
      templateId: template.id,
      templateName: template.name,
      templateVersion: template.version,
    });
  });
}

export function resolvePmProcedure(
  equipment: EquipmentProcedureInput,
  templates: PmTemplateForMatch[]
): ResolvedPmProcedure {
  // Any non-empty procedure, including a single code such as "PM-MON", stays custom.
  if (String(equipment.pmProc1 || "").trim().length > 0) {
    return {
      items: buildPmChecklist(equipment.pmProc1),
      source: "CUSTOM",
      templateId: null,
      templateName: null,
      templateVersion: null,
      reason: null,
    };
  }

  const pinnedId = String(equipment.pmTemplateId || "").trim();
  if (pinnedId) {
    const pinned = templates.find((template) => template.id === pinnedId && template.active);
    if (pinned && pinned.steps.length > 0) {
      return {
        items: checklistFromTemplate(pinned),
        source: "LIBRARY",
        templateId: pinned.id,
        templateName: pinned.name,
        templateVersion: pinned.version,
        reason: "pinned",
      };
    }
  }

  const match = bestPmTemplate(equipment, templates);
  if (match && match.template.steps.length > 0) {
    return {
      items: checklistFromTemplate(match.template),
      source: "LIBRARY",
      templateId: match.template.id,
      templateName: match.template.name,
      templateVersion: match.template.version,
      reason: match.reason,
    };
  }

  return {
    items: buildPmChecklist(null),
    source: "GENERIC",
    templateId: null,
    templateName: null,
    templateVersion: null,
    reason: null,
  };
}

/**
 * True when a saved checklist is only the untouched generic fallback step
 * (no library template, no result, reading, or note recorded).
 */
export function isGenericOnlyChecklist(items: PmChecklistItem[]): boolean {
  if (items.length !== 1) return false;
  const item = items[0];
  return (
    item.text.trim() === GENERIC_PM_STEP_TEXT &&
    !item.templateId &&
    !item.done &&
    item.result == null &&
    item.reading == null &&
    !String(item.note || "").trim()
  );
}

/**
 * Saved checklist JSON wins, except an OPEN work order whose saved checklist
 * is only the untouched generic step: that one re-resolves from the library
 * so a procedure added or pinned later shows up. Open work orders with no snapshot resolve live
 * (custom text, then library, then the generic step). Closed work orders with
 * no snapshot stay on the text procedure so old records do not gain steps
 * that were not performed.
 */
export function checklistForWorkOrder(opts: {
  status: string;
  pmChecklist: unknown;
  pmProc1?: string | null;
  equipmentPmProc1?: string | null;
  description?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  pmTemplateId?: string | null;
  templates: PmTemplateForMatch[];
}): {
  items: PmChecklistItem[];
  resolved: ResolvedPmProcedure | null;
  fromSnapshot: boolean;
} {
  const existing = normalizePmChecklist(opts.pmChecklist);
  if (existing.length > 0) {
    if (opts.status === "OPEN" && isGenericOnlyChecklist(existing)) {
      const resolved = resolvePmProcedure(
        {
          pmProc1: opts.pmProc1 || opts.equipmentPmProc1,
          description: opts.description,
          manufacturer: opts.manufacturer,
          model: opts.model,
          pmTemplateId: opts.pmTemplateId,
        },
        opts.templates
      );
      if (resolved.source !== "GENERIC") {
        return { items: resolved.items, resolved, fromSnapshot: false };
      }
    }
    return { items: existing, resolved: null, fromSnapshot: true };
  }
  if (opts.status !== "OPEN") {
    return {
      items: buildPmChecklist(opts.pmProc1 || opts.equipmentPmProc1),
      resolved: null,
      fromSnapshot: false,
    };
  }
  const resolved = resolvePmProcedure(
    {
      pmProc1: opts.pmProc1 || opts.equipmentPmProc1,
      description: opts.description,
      manufacturer: opts.manufacturer,
      model: opts.model,
      pmTemplateId: opts.pmTemplateId,
    },
    opts.templates
  );
  return { items: resolved.items, resolved, fromSnapshot: false };
}

export function procedureSourceLabel(resolved: ResolvedPmProcedure): string {
  if (resolved.source === "CUSTOM") return "Custom procedure on the equipment";
  if (resolved.source === "LIBRARY") {
    const version =
      resolved.templateVersion != null ? ` (v${resolved.templateVersion})` : "";
    const how =
      resolved.reason === "pinned"
        ? "pinned template"
        : resolved.reason
          ? `matched on ${resolved.reason.replace(/\+/g, " + ")}`
          : "library template";
    return `${resolved.templateName || "Library template"}${version} — ${how}`;
  }
  return "Generic step (no custom procedure and no library match)";
}

export type EquipmentMatchPreview = {
  wouldUse: PmProcedureSource;
  templateId: string | null;
  templateName: string | null;
  reason: string | null;
  hasCustomProcedure: boolean;
};

export function previewEquipmentProcedure(
  equipment: EquipmentProcedureInput,
  templates: PmTemplateForMatch[]
): EquipmentMatchPreview {
  const resolved = resolvePmProcedure(equipment, templates);
  return {
    wouldUse: resolved.source,
    templateId: resolved.templateId,
    templateName: resolved.templateName,
    reason: resolved.reason,
    hasCustomProcedure: resolved.source === "CUSTOM",
  };
}

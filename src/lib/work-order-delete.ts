/**
 * Shared rules for deleting work orders.
 * Single delete and the PM list bulk delete both use these checks:
 * only an OPEN PM or CM can be removed, and a closed record is kept.
 * Bulk delete on the PM list is narrower: PM only.
 */

import { parseWorkOrderFilters, type ParsedWorkOrderFilters } from "./work-order-filters";

export const WORK_ORDER_DELETE_TYPES = ["PM", "CM"] as const;

export const BULK_PM_DELETE_MAX_IDS = 5000;

export type WorkOrderDeleteRefusal = "not_found" | "wrong_type" | "not_open";

export function workOrderDeleteRefusal(
  wo: { type: string; status: string } | null | undefined,
  allowedTypes: readonly string[] = WORK_ORDER_DELETE_TYPES
): WorkOrderDeleteRefusal | null {
  if (!wo) return "not_found";
  if (!allowedTypes.includes(wo.type)) return "wrong_type";
  if (wo.status !== "OPEN") return "not_open";
  return null;
}

export function workOrderDeleteError(reason: WorkOrderDeleteRefusal): string {
  if (reason === "not_found") return "Work order not found";
  if (reason === "wrong_type") return "Only PM or CM work orders can be deleted";
  return "Only open work orders can be deleted — closed records are kept for history";
}

export type PmBulkDeleteRow = {
  id: string;
  type: string;
  status: string;
};

export function partitionPmBulkDelete<T extends PmBulkDeleteRow>(rows: T[]): {
  deletable: T[];
  skippedClosed: T[];
  skippedOther: T[];
} {
  const deletable: T[] = [];
  const skippedClosed: T[] = [];
  const skippedOther: T[] = [];
  for (const row of rows) {
    const reason = workOrderDeleteRefusal(row, ["PM"]);
    if (!reason) {
      deletable.push(row);
      continue;
    }
    if (row.type === "PM" && row.status === "CLOSED") skippedClosed.push(row);
    else skippedOther.push(row);
  }
  return { deletable, skippedClosed, skippedOther };
}

export function formatBulkPmDeleteResult(result: {
  deleted: number;
  skippedClosed: number;
  skippedOther: number;
}): string {
  const parts = [`Deleted ${result.deleted}`];
  if (result.skippedClosed > 0) {
    parts.push(`skipped ${result.skippedClosed} closed`);
  }
  if (result.skippedOther > 0) {
    parts.push(
      `skipped ${result.skippedOther} that cannot be deleted`
    );
  }
  return parts.join(", ");
}

export function bulkPmDeleteConfirmMessage(count: number): string {
  const noun = count === 1 ? "work order" : "work orders";
  return `This will permanently delete ${count} selected PM ${noun}. This cannot be undone.`;
}

export function describePmBulkSelection(args: {
  selectedCount: number;
  openMatchCount: number;
  selectingAllMatching: boolean;
  totalPages: number;
  narrowedFromAll: boolean;
}): string {
  const { selectedCount, openMatchCount, selectingAllMatching, totalPages } = args;
  if (openMatchCount === 0) {
    return "No open PM work orders in this filter can be deleted.";
  }
  if (selectedCount === 0) {
    if (totalPages > 1) {
      return `None selected. Select all includes all ${openMatchCount} open PM work orders matching this filter, including other pages.`;
    }
    return `None selected. Select all includes all ${openMatchCount} open PM work orders matching this filter.`;
  }
  if (selectingAllMatching) {
    if (totalPages > 1) {
      return `${selectedCount} selected — all open PM work orders matching this filter, including other pages.`;
    }
    return `${selectedCount} selected — all open PM work orders matching this filter.`;
  }
  if (args.narrowedFromAll) {
    return `${selectedCount} of ${openMatchCount} open PM work orders matching this filter are selected.`;
  }
  if (totalPages > 1 && selectedCount < openMatchCount) {
    return `${selectedCount} selected on this page. Select all to include all ${openMatchCount} open PM work orders matching this filter, including other pages.`;
  }
  return `${selectedCount} selected.`;
}

export type BulkPmDeleteRequest =
  | { selection: "ids"; ids: string[] }
  | {
      selection: "filter";
      filters: ParsedWorkOrderFilters;
      excludeIds: string[];
    };

function readIds(formData: FormData, name: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of formData.getAll(name)) {
    const id = String(value || "").trim();
    if (!id || id.length > 64 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** Parse the bulk-delete form. Page is ignored: select-all is the full filter. */
export function parseBulkPmDeleteForm(
  formData: FormData
): { ok: true; request: BulkPmDeleteRequest } | { ok: false; error: string } {
  if (String(formData.get("confirmDelete") || "") !== "yes") {
    return {
      ok: false,
      error: "Confirm the delete to remove the selected PM work orders",
    };
  }
  const selection = String(formData.get("selection") || "").trim();
  if (selection === "ids") {
    const ids = readIds(formData, "id");
    if (ids.length === 0) {
      return { ok: false, error: "Select at least one PM work order" };
    }
    if (ids.length > BULK_PM_DELETE_MAX_IDS) {
      return { ok: false, error: "Too many work orders selected" };
    }
    return { ok: true, request: { selection: "ids", ids } };
  }
  if (selection === "filter") {
    const status = String(formData.get("status") || "")
      .trim()
      .toUpperCase();
    if (status !== "OPEN" && status !== "CLOSED" && status !== "ALL") {
      return {
        ok: false,
        error: "Could not determine which PM work orders to delete",
      };
    }
    const excludeIds = readIds(formData, "excludeId");
    if (excludeIds.length > BULK_PM_DELETE_MAX_IDS) {
      return { ok: false, error: "Too many work orders excluded" };
    }
    const filters = parseWorkOrderFilters({
      q: String(formData.get("q") || ""),
      status,
      facility: String(formData.get("facility") || ""),
      from: String(formData.get("from") || ""),
      to: String(formData.get("to") || ""),
      tech: String(formData.get("tech") || ""),
      pmResult: String(formData.get("pmResult") || ""),
      pmMonth: String(formData.get("pmMonth") || ""),
      page: "1",
    });
    return { ok: true, request: { selection: "filter", filters, excludeIds } };
  }
  return { ok: false, error: "Select at least one PM work order" };
}

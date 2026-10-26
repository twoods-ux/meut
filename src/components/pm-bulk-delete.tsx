"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { deleteSelectedPmWorkOrders } from "@/lib/actions";
import {
  bulkPmDeleteConfirmMessage,
  describePmBulkSelection,
} from "@/lib/work-order-delete";

type BulkFilters = {
  q: string;
  status: "OPEN" | "CLOSED" | "ALL";
  facility: string;
  from: string;
  to: string;
  tech: string;
  pmResult: "ALL" | "PASS" | "FAIL";
  pmMonth: string;
};

type SelectionContextValue = {
  openMatchCount: number;
  allMatching: boolean;
  indeterminate: boolean;
  toggleAll: () => void;
  toggleRow: (id: string, checked: boolean) => void;
  isChecked: (id: string) => boolean;
  totalPages: number;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

function useSelection(): SelectionContextValue {
  const value = useContext(SelectionContext);
  if (!value) {
    throw new Error("PM bulk selection is only available inside the list");
  }
  return value;
}

function withParams(path: string, extra: Record<string, string>): string {
  const splitAt = path.indexOf("?");
  const pathname = splitAt === -1 ? path : path.slice(0, splitAt);
  const params = new URLSearchParams(splitAt === -1 ? "" : path.slice(splitAt + 1));
  for (const [key, value] of Object.entries(extra)) {
    params.set(key, value);
  }
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function PmBulkDelete({
  children,
  returnPath,
  openMatchCount,
  closedMatchCount,
  totalPages,
  filters,
}: {
  children: ReactNode;
  returnPath: string;
  openMatchCount: number;
  closedMatchCount: number;
  totalPages: number;
  filters: BulkFilters;
}) {
  const router = useRouter();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<"ids" | "filter">("ids");
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const selectedCount =
    mode === "filter"
      ? Math.max(0, openMatchCount - excluded.size)
      : ids.size;
  const allMatching =
    mode === "filter" && excluded.size === 0 && openMatchCount > 0;
  const indeterminate = selectedCount > 0 && !allMatching;
  const summary = describePmBulkSelection({
    selectedCount,
    openMatchCount,
    selectingAllMatching: allMatching,
    totalPages,
    narrowedFromAll: mode === "filter" && excluded.size > 0 && selectedCount > 0,
  });

  function clearSelection() {
    setMode("ids");
    setIds(new Set());
    setExcluded(new Set());
  }

  function toggleAll() {
    if (openMatchCount === 0) return;
    if (allMatching) {
      clearSelection();
      return;
    }
    setMode("filter");
    setIds(new Set());
    setExcluded(new Set());
  }

  function toggleRow(id: string, checked: boolean) {
    if (mode === "filter") {
      setExcluded((current) => {
        const next = new Set(current);
        if (checked) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    setIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function isChecked(id: string) {
    if (mode === "filter") return !excluded.has(id);
    return ids.has(id);
  }

  const selection: SelectionContextValue = {
    openMatchCount,
    allMatching,
    indeterminate,
    toggleAll,
    toggleRow,
    isChecked,
    totalPages,
  };

  useEffect(() => {
    if (!confirming) return;
    cancelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) setConfirming(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, pending]);

  async function confirmDelete() {
    if (selectedCount === 0 || pending) return;
    setPending(true);
    setError("");
    const formData = new FormData();
    formData.set("confirmDelete", "yes");
    if (mode === "filter") {
      formData.set("selection", "filter");
      formData.set("q", filters.q);
      formData.set("status", filters.status);
      formData.set("facility", filters.facility);
      formData.set("from", filters.from);
      formData.set("to", filters.to);
      formData.set("tech", filters.tech);
      formData.set("pmResult", filters.pmResult);
      formData.set("pmMonth", filters.pmMonth);
      for (const id of Array.from(excluded)) formData.append("excludeId", id);
    } else {
      formData.set("selection", "ids");
      for (const id of Array.from(ids)) formData.append("id", id);
    }
    try {
      const result = await deleteSelectedPmWorkOrders(formData);
      if (!result.ok) {
        router.push(withParams(returnPath, { error: result.error.slice(0, 300) }));
        router.refresh();
        return;
      }
      router.push(
        withParams(returnPath, {
          bulkDeleted: String(result.deleted),
          bulkSkippedClosed: String(result.skippedClosed),
          bulkSkippedOther: String(result.skippedOther),
        })
      );
      router.refresh();
    } catch {
      setPending(false);
      setError("Could not delete work orders");
    }
  }

  return (
    <SelectionContext.Provider value={selection}>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 print:hidden">
        <button
          type="button"
          className="btn-danger"
          disabled={selectedCount === 0 || pending}
          onClick={() => {
            setError("");
            setConfirming(true);
          }}
        >
          Delete selected
        </button>
        <p className="text-sm text-slate-600">{summary}</p>
        {closedMatchCount > 0 ? (
          <p className="w-full text-xs text-slate-500">
            {closedMatchCount} closed work order
            {closedMatchCount === 1 ? "" : "s"} in this filter cannot be selected.
          </p>
        ) : null}
      </div>
      {children}
      {confirming ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) {
              setConfirming(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="card w-full max-w-md shadow-lift"
          >
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Delete selected PM work orders
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              {bulkPmDeleteConfirmMessage(selectedCount)}
            </p>
            {mode === "filter" && closedMatchCount > 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                {closedMatchCount} closed work order
                {closedMatchCount === 1 ? "" : "s"} in this filter will be skipped.
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={pending}
                onClick={() => void confirmDelete()}
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SelectionContext.Provider>
  );
}

export function PmSelectAllCheckbox() {
  const inputRef = useRef<HTMLInputElement>(null);
  const selection = useSelection();
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = selection.indeterminate;
    }
  }, [selection.indeterminate]);
  const label =
    selection.totalPages > 1
      ? `Select all ${selection.openMatchCount} open PM work orders matching this filter, including other pages`
      : `Select all ${selection.openMatchCount} open PM work orders matching this filter`;
  return (
    <input
      ref={inputRef}
      type="checkbox"
      className="h-4 w-4"
      checked={selection.allMatching}
      disabled={selection.openMatchCount === 0}
      onChange={selection.toggleAll}
      aria-label={label}
      title={label}
    />
  );
}

export function PmRowCheckbox({
  id,
  woNumber,
  selectable,
  blockedTitle = "Only open work orders can be deleted",
}: {
  id: string;
  woNumber: number;
  selectable: boolean;
  blockedTitle?: string;
}) {
  const selection = useSelection();
  if (!selectable) {
    return (
      <input
        type="checkbox"
        className="h-4 w-4"
        disabled
        aria-label={`PM ${woNumber} cannot be deleted`}
        title={blockedTitle}
      />
    );
  }
  return (
    <input
      type="checkbox"
      className="h-4 w-4"
      checked={selection.isChecked(id)}
      onChange={(event) => selection.toggleRow(id, event.target.checked)}
      aria-label={`Select PM ${woNumber}`}
    />
  );
}

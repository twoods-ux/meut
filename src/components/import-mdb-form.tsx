"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ImportMdbCounts } from "@/lib/import-mdb";

type LastImport = {
  at: string | null;
  counts: ImportMdbCounts | null;
};

export function ImportMdbForm({ lastImport }: { lastImport: LastImport }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    counts: ImportMdbCounts;
    warnings: string[];
  } | null>(null);

  async function onImport() {
    setError(null);
    setResult(null);
    if (!file) {
      setError("Choose a .mdb file first.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".mdb")) {
      setError("File must end with .mdb");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/mdb", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : `Import failed (${res.status})`
        );
        return;
      }
      setResult({
        counts: data.counts,
        warnings: data.warnings ?? [],
      });
      setFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  const displayCounts = result?.counts ?? lastImport.counts;

  return (
    <div className="card">
      <h2 className="mb-1 font-semibold text-slate-900">Import Access data</h2>
      <p className="mb-3 text-sm text-slate-500">
        Close HarvestCEMS, copy{" "}
        <code className="rounded bg-slate-100 px-1 text-xs">
          C:\Harvest Biomed Data\HarvestCEMSdata.mdb
        </code>
        , upload here.
      </p>

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Import upserts from the Access file; HarvestCEMS remains source of truth
        until cutover.
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            HarvestCEMSdata.mdb
          </span>
          <input
            type="file"
            accept=".mdb,application/x-msaccess,application/vnd.ms-access"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#4070D0] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#355fb0] file:cursor-pointer"
          />
        </label>
        <button
          type="button"
          disabled={busy || !file}
          onClick={onImport}
          className="rounded-lg bg-[#4070D0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#355fb0] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </div>

      {file ? (
        <p className="mt-2 text-xs text-slate-500">
          Selected: {file.name} ({Math.round(file.size / 1024)} KB)
        </p>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Import succeeded.
          {result.warnings?.length ? (
            <ul className="mt-1 list-inside list-disc text-emerald-800">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {displayCounts ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {result
              ? "This import"
              : lastImport.at
                ? `Last import (${new Date(lastImport.at).toLocaleString()})`
                : "Last import"}
          </p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["Hospitals", displayCounts.hospitals],
                ["Departments", displayCounts.departments],
                ["Technicians", displayCounts.technicians],
                ["Equipment", displayCounts.equipment],
                ["Contracts", displayCounts.contracts],
                ["Manufacturers", displayCounts.manufacturers],
                ["Vendors", displayCounts.vendors],
                ["Work orders", displayCounts.workOrders],
              ] as const
            ).map(([label, n]) => (
              <div
                key={label}
                className="rounded-lg bg-slate-50 px-3 py-2 text-center"
              >
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-lg font-bold text-[#4070D0]">{n}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">No import recorded yet.</p>
      )}
    </div>
  );
}

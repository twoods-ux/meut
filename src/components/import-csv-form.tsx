"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Counts = { facilities: number; equipment: number; skipped: number };

export function ImportCsvForm() {
  const router = useRouter();
  const [kind, setKind] = useState<"facilities" | "equipment">("equipment");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    counts: Counts;
    warnings: string[];
  } | null>(null);

  async function onImport() {
    setError(null);
    setResult(null);
    if (!file) {
      setError("Choose a .csv file first.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const res = await fetch("/api/import/csv", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : `Import failed (${res.status})`
        );
        return;
      }
      setResult({ counts: data.counts, warnings: data.warnings ?? [] });
      setFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 className="mb-1 font-semibold text-slate-900">Import CSV data</h2>
      <p className="mb-3 text-sm text-slate-500">
        For customers without HarvestCEMS — upload Excel-exported CSV for
        facilities or equipment. Upserts by ID (won&apos;t wipe other data).
      </p>

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <a
          className="font-semibold text-brand-600 hover:underline"
          href="/templates/meut-facilities-template.csv"
          download
        >
          Download facilities template
        </a>
        <span className="text-slate-300">·</span>
        <a
          className="font-semibold text-brand-600 hover:underline"
          href="/templates/meut-equipment-template.csv"
          download
        >
          Download equipment template
        </a>
      </div>

      <div className="mb-4 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="csvKind"
            checked={kind === "facilities"}
            onChange={() => setKind("facilities")}
          />
          Facilities
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="csvKind"
            checked={kind === "equipment"}
            onChange={() => setKind("equipment")}
          />
          Equipment
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="csvFile">
            CSV file
          </label>
          <input
            id="csvFile"
            type="file"
            accept=".csv,text/csv"
            className="block w-full max-w-xs text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={onImport}
        >
          {busy ? "Importing…" : "Import CSV"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {result ? (
        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
          Imported {result.counts.facilities} facilities,{" "}
          {result.counts.equipment} equipment
          {result.counts.skipped
            ? ` (${result.counts.skipped} skipped)`
            : ""}
          .
          {result.warnings.length ? (
            <ul className="mt-2 list-disc pl-5 text-amber-900">
              {result.warnings.slice(0, 8).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

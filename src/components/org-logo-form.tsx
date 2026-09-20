"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function OrgLogoForm({ hasLogo }: { hasLogo: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const bust = Date.now();

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setOk("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/org/logo", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Upload failed");
      return;
    }
    setOk("Logo saved — it will appear on printed work orders and reports.");
    router.refresh();
  }

  async function onRemove() {
    setError("");
    setOk("");
    setLoading(true);
    const res = await fetch("/api/org/logo", { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      setError("Could not remove logo");
      return;
    }
    setOk("Custom logo removed. Prints will use the MEUT mark.");
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="font-semibold text-slate-900">Company logo</h2>
      <p className="mt-1 text-sm text-slate-500">
        Upload your logo for branding on printed work orders and reports. PNG,
        JPEG, or WebP, max 500KB. If none is set, MEUT branding is used.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hasLogo ? `/api/org/logo?t=${bust}` : "/meut-logo.png"}
            alt={hasLogo ? "Your company logo" : "MEUT default"}
            className="h-14 w-auto max-w-[220px] object-contain"
          />
        </div>
        <form onSubmit={onUpload} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="logo">
              Choose file
            </label>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              required
              className="block w-full max-w-xs text-sm text-slate-600"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Saving…" : "Upload logo"}
          </button>
          {hasLogo ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={loading}
              onClick={onRemove}
            >
              Remove
            </button>
          ) : null}
        </form>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      ) : null}
      {ok ? (
        <p className="mt-3 text-sm text-emerald-700">{ok}</p>
      ) : null}
    </div>
  );
}

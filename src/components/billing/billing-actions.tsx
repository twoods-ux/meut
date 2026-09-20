"use client";

import { useState } from "react";
import type { BillingInterval } from "@/lib/billing";
import {
  BILLING_PRICES_USD,
  formatUsd,
} from "@/lib/billing";
import { LICENSE_TIERS, TIER_ORDER, isLicenseTier, type SellableTier } from "@/lib/license";
import { cn } from "@/lib/utils";

export function BillingActions({
  currentTier,
  billingInterval,
  extraSeats,
  hasStripeCustomer,
  hasSubscription,
}: {
  currentTier: SellableTier | string;
  billingInterval: BillingInterval | null;
  extraSeats: number;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>(
    billingInterval || "MONTHLY"
  );
  const [seatQty, setSeatQty] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function checkout(body: Record<string, unknown>) {
    setError("");
    setMessage("");
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setMessage(data.message || "Updated");
  }

  async function openPortal() {
    setBusy("portal");
    setError("");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Portal failed");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal failed");
    } finally {
      setBusy(null);
    }
  }

  async function subscribe(tier: SellableTier) {
    setBusy(tier);
    try {
      await checkout({ tier, interval, extraSeats: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  async function buySeats() {
    setBusy("seats");
    try {
      await checkout({
        tier: currentTier,
        interval: billingInterval || interval,
        extraSeats: seatQty,
        seatsOnly: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add seats");
    } finally {
      setBusy(null);
    }
  }

  const seatPrice =
    (billingInterval || interval) === "ANNUAL"
      ? BILLING_PRICES_USD.EXTRA_SEAT.annual
      : BILLING_PRICES_USD.EXTRA_SEAT.monthly;

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {message}
        </p>
      ) : null}

      <div className="card">
        <h2 className="mb-1 font-semibold text-slate-900">Billing</h2>
        <p className="mb-4 text-sm text-slate-500">
          Current plan{" "}
          <span className="font-semibold text-slate-800">
            {LICENSE_TIERS[isLicenseTier(currentTier) ? currentTier : 'STARTER'].name}
          </span>
          {billingInterval ? (
            <>
              {" "}
              · billed{" "}
              <span className="font-semibold">
                {billingInterval === "ANNUAL" ? "annually" : "monthly"}
              </span>
            </>
          ) : (
            " · not linked to Stripe yet"
          )}
          {extraSeats > 0 ? (
            <>
              {" "}
              · <span className="font-semibold">{extraSeats}</span> extra seat
              {extraSeats === 1 ? "" : "s"}
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={!hasStripeCustomer || busy === "portal"}
            onClick={openPortal}
            title={
              hasStripeCustomer
                ? "Open Stripe Customer Portal"
                : "Subscribe first to manage billing"
            }
          >
            {busy === "portal" ? "Opening…" : "Manage billing"}
          </button>
          {!hasSubscription ? (
            <a href="/pricing" className="btn-secondary">
              View pricing
            </a>
          ) : null}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 font-semibold text-slate-900">Buy extra seats</h2>
        <p className="mb-4 text-sm text-slate-500">
          {formatUsd(seatPrice)} per seat /{" "}
          {(billingInterval || interval) === "ANNUAL" ? "year" : "month"}. Adds
          to your plan cap (
          {LICENSE_TIERS[isLicenseTier(currentTier) ? currentTier : 'STARTER'].maxSeats ?? '∞'} included + extras).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="seatQty">
              Quantity
            </label>
            <input
              id="seatQty"
              className="input w-28"
              type="number"
              min={1}
              max={100}
              value={seatQty}
              onChange={(e) =>
                setSeatQty(Math.max(1, parseInt(e.target.value || "1", 10)))
              }
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy === "seats"}
            onClick={buySeats}
          >
            {busy === "seats" ? "Working…" : "Buy seats"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 font-semibold text-slate-900">Change plan</h2>
        <p className="mb-4 text-sm text-slate-500">
          Start Checkout for a new subscription (or use Manage billing to change
          an existing one).
        </p>
        <div className="mb-4 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
          {(["MONTHLY", "ANNUAL"] as BillingInterval[]).map((iv) => (
            <button
              key={iv}
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                interval === iv
                  ? "bg-[#4070D0] text-white"
                  : "text-slate-600"
              )}
              onClick={() => setInterval(iv)}
            >
              {iv === "MONTHLY" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {TIER_ORDER.map((id) => {
            const t = LICENSE_TIERS[id];
            const price =
              interval === "ANNUAL"
                ? BILLING_PRICES_USD[id].annual
                : BILLING_PRICES_USD[id].monthly;
            const current = id === currentTier && hasSubscription;
            return (
              <button
                key={id}
                type="button"
                disabled={current || busy === id}
                className={cn(
                  "rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                  current
                    ? "cursor-default bg-[#4070D0] text-white"
                    : "border border-slate-200 bg-white text-slate-800 hover:border-[#4070D0] hover:text-[#4070D0]"
                )}
                onClick={() => subscribe(id)}
              >
                {busy === id
                  ? "…"
                  : current
                    ? `✓ ${t.name}`
                    : `${t.name} · ${formatUsd(price)}`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

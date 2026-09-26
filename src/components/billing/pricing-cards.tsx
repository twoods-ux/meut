"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BILLING_PRICES_USD,
  formatUsd,
  type BillingInterval,
} from "@/lib/billing";
import { LICENSE_TIERS, TIER_ORDER, type SellableTier } from "@/lib/license";
import { cn } from "@/lib/utils";

async function startCheckout(opts: {
  tier: SellableTier;
  interval: BillingInterval;
  extraSeats?: number;
}) {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Checkout failed");
  if (data.url) {
    window.location.href = data.url;
    return;
  }
  throw new Error(data.message || "No checkout URL returned");
}

function PricingCardsInner({
  highlightTier,
}: {
  highlightTier?: SellableTier;
}) {
  const { data: session, status } = useSession();
  const search = useSearchParams();
  const initialInterval = (search.get("interval") === "ANNUAL" ? "ANNUAL" : "MONTHLY") as BillingInterval;
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const isSupervisor = session?.user?.role === "SUPERVISOR";
  const isLoggedIn = status === "authenticated";
  const sessionReady = status !== "loading";

  const saveLabel = useMemo(
    () => (interval === "ANNUAL" ? "2 months free" : null),
    [interval]
  );

  async function onCta(tier: SellableTier) {
    setError("");
    if (!sessionReady) return;
    setBusy(tier);
    try {
      if (isLoggedIn && !isSupervisor) {
        setError("Ask a supervisor to manage billing for your organization.");
      } else {
        // Logged out: pending-signup Checkout. Supervisor: Checkout for their org.
        await startCheckout({ tier, interval });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }


  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    const auto = search.get("autocheckout");
    const tierParam = search.get("tier");
    if (auto !== "1" || !tierParam || status !== "authenticated") return;
    if (session?.user?.role !== "SUPERVISOR") return;
    if (!TIER_ORDER.includes(tierParam as SellableTier)) return;
    autoStarted.current = true;
    void onCta(tierParam as SellableTier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search, session?.user?.role]);

  return (
    <div>
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              interval === "MONTHLY"
                ? "bg-[#4070D0] text-white"
                : "text-slate-600 hover:text-slate-900"
            )}
            onClick={() => setInterval("MONTHLY")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              interval === "ANNUAL"
                ? "bg-[#4070D0] text-white"
                : "text-slate-600 hover:text-slate-900"
            )}
            onClick={() => setInterval("ANNUAL")}
          >
            Annual
            {saveLabel ? (
              <span className="ml-2 text-xs font-medium opacity-90">
                ({saveLabel})
              </span>
            ) : null}
          </button>
        </div>
        <p className="text-sm text-slate-500">
          Extra seats:{" "}
          <span className="font-semibold text-slate-800">
            {formatUsd(
              interval === "ANNUAL"
                ? BILLING_PRICES_USD.EXTRA_SEAT.annual
                : BILLING_PRICES_USD.EXTRA_SEAT.monthly
            )}
          </span>
          /{interval === "ANNUAL" ? "yr" : "mo"} each
        </p>
      </div>

      {error ? (
        <p className="mb-6 rounded-lg bg-rose-50 px-3 py-2 text-center text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {TIER_ORDER.map((id) => {
          const t = LICENSE_TIERS[id];
          const price =
            interval === "ANNUAL"
              ? BILLING_PRICES_USD[id].annual
              : BILLING_PRICES_USD[id].monthly;
          const featured = id === (highlightTier || "PROFESSIONAL");
          return (
            <div
              key={id}
              className={cn(
                "card relative flex flex-col",
                featured && "ring-2 ring-[#4070D0] shadow-lg"
              )}
            >
              {featured ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#4070D0] px-3 py-0.5 text-xs font-semibold text-white">
                  Popular
                </span>
              ) : null}
              <h3 className="text-lg font-bold text-slate-900">{t.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{t.description}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-slate-900">
                  {formatUsd(price)}
                </span>
                <span className="text-sm text-slate-500">
                  /{interval === "ANNUAL" ? "year" : "month"}
                </span>
              </p>
              {interval === "ANNUAL" ? (
                <p className="mt-1 text-xs text-emerald-700">
                  Equivalent to {formatUsd(BILLING_PRICES_USD[id].monthly)}
                  /mo billed annually
                </p>
              ) : null}
              <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-600">
                {t.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span className="text-[#4070D0]">✓</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={cn(
                  "mt-6 w-full py-2.5",
                  featured ? "btn-primary" : "btn-secondary"
                )}
                disabled={busy === id || !sessionReady}
                onClick={() => onCta(id)}
              >
                {busy === id
                  ? "Redirecting…"
                  : isLoggedIn && isSupervisor
                    ? "Subscribe"
                    : isLoggedIn
                      ? "Contact supervisor"
                      : "Get started"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-[#4070D0] hover:underline"
        >
          Log in
        </Link>{" "}
        · Supervisors manage billing under Settings
      </p>
    </div>
  );
}

export function PricingCards(props: { highlightTier?: SellableTier }) {
  return (
    <Suspense fallback={<div className="text-center text-sm text-slate-500">Loading plans…</div>}>
      <PricingCardsInner {...props} />
    </Suspense>
  );
}

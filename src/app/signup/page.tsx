"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signupOrganization } from "@/lib/actions";
import { LICENSE_TIERS, TIER_ORDER, type SellableTier } from "@/lib/license";
import {
  BILLING_PRICES_USD,
  formatUsd,
  type BillingInterval,
} from "@/lib/billing";
import { PricingCards } from "@/components/billing/pricing-cards";
import { SiteFooter } from "@/components/site-footer";

function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const defaultTier = (search.get("tier") || "STARTER") as SellableTier;
  const defaultInterval = (search.get("interval") || "MONTHLY") as BillingInterval;
  const checkoutSessionId = search.get("session_id") || "";

  const priceHint = useMemo(() => {
    const tier = TIER_ORDER.includes(defaultTier) ? defaultTier : "STARTER";
    const interval =
      defaultInterval === "ANNUAL" ? "ANNUAL" : "MONTHLY";
    const amount =
      interval === "ANNUAL"
        ? BILLING_PRICES_USD[tier].annual
        : BILLING_PRICES_USD[tier].monthly;
    return `${LICENSE_TIERS[tier].name} · ${formatUsd(amount)}/${interval === "ANNUAL" ? "yr" : "mo"}`;
  }, [defaultTier, defaultInterval]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    if (checkoutSessionId) {
      fd.set("checkoutSessionId", checkoutSessionId);
    }
    const res = await signupOrganization(fd);
    if (!res.ok) {
      setLoading(false);
      setError(res.error);
      return;
    }

    setLoading(false);
    router.push("/login?billing=claimed");
    router.refresh();
  }

  if (!checkoutSessionId) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--background)]">
        <header className="border-b border-slate-200/80 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/login" className="flex items-center gap-3">
              <Image
                src="/meut-logo.png"
                alt="M.E.U.T."
                width={140}
                height={48}
                className="h-10 w-auto"
                priority
              />
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Log in
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4070D0]">
              Create your organization
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Payment is required to create an organization
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-slate-500">
              Choose a plan to start secure checkout. After payment you will
              return here to finish signup. No organization is created until
              payment succeeds.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              <Link
                href="/pricing"
                className="font-semibold text-[#4070D0] hover:underline"
              >
                View pricing
              </Link>
            </p>
          </div>
          <PricingCards />
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="auth-shell !flex-col !justify-between gap-6">
      <div className="flex w-full flex-1 items-center justify-center py-4">
      <div className="auth-card">
        <div className="mb-1 flex justify-center">
          <Image
            src="/meut-logo.png"
            alt="M.E.U.T."
            width={320}
            height={120}
            className="h-auto w-full max-w-[260px]"
            priority
          />
        </div>
        <p className="mb-1 text-center text-sm font-medium text-slate-600">
          Medical Equipment User Tracking
        </p>
        <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Create your organization
        </p>
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800 ring-1 ring-emerald-200">
          Payment received. Create your organization to activate the subscription.
          {search.get("tier") ? (
            <>
              {" "}
              Plan: <strong>{priceHint}</strong>
            </>
          ) : null}
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="orgName">
              Organization name
            </label>
            <input
              className="input"
              id="orgName"
              name="orgName"
              required
              placeholder="Acme Clinical Engineering"
            />
          </div>
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input className="input" id="name" name="name" required />
          </div>
          <div>
            <label className="label" htmlFor="username">
              Username
            </label>
            <input className="input" id="username" name="username" required />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="label !mb-0" htmlFor="password">
                Password
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Show password
              </label>
            </div>
            <input
              className="input"
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
            />
          </div>
          <input type="hidden" name="checkoutSessionId" value={checkoutSessionId} />
          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="btn-primary w-full py-2.5 text-[15px]"
            disabled={loading}
          >
            {loading ? "Creating…" : "Create organization"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            Log in
          </Link>
          {" · "}
          <Link
            href="/pricing"
            className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            Pricing
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-slate-400">
          Having trouble?{" "}
          <a
            href="mailto:support@meut.app"
            className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            support@meut.app
          </a>
        </p>
      </div>
      </div>
      <SiteFooter variant="dark" />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-shell">
          <div className="auth-card text-center text-sm text-slate-500">
            Loading…
          </div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}

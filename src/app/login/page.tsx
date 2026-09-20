"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const nextPath = safeNextPath(search.get("next"));
  const fromSignup = search.get("signup") === "1";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      username: String(fd.get("username")),
      password: String(fd.get("password")),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid username or password");
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="auth-shell">
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
        <p className="mb-7 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Sign in to your account
        </p>
        {fromSignup ? (
          <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800 ring-1 ring-emerald-200">
            Organization created. Log in to complete Stripe checkout for your
            plan.
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="username">
              User Name
            </label>
            <input
              className="input"
              id="username"
              name="username"
              required
              autoFocus
              autoComplete="username"
              defaultValue="supervisor"
            />
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
              autoComplete="current-password"
              defaultValue="password"
            />
          </div>
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
            {loading ? "Signing in…" : "Log In"}
          </button>
        </form>
        <div className="mt-6 rounded-xl bg-slate-50 px-3 py-2.5 text-center text-xs text-slate-500 ring-1 ring-slate-100">
          Demo: <strong className="text-slate-700">supervisor</strong> /{" "}
          <strong className="text-slate-700">tech</strong> /{" "}
          <strong className="text-slate-700">customer</strong> — password{" "}
          <strong className="text-slate-700">password</strong>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          New customer?{" "}
          <Link
            href="/signup"
            className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            Create an organization
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
  );
}

export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  );
}

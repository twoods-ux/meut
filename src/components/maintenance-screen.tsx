import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { MAINTENANCE_PUBLIC_MESSAGE } from "@/lib/maintenance";

/** Public “signup closed” screen. Login, terms, and privacy stay linked. */
export function MaintenanceScreen() {
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
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4070D0]">
          M.E.U.T.
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Temporarily unavailable
        </h1>
        <p className="mt-4 text-slate-600">{MAINTENANCE_PUBLIC_MESSAGE}</p>
        <Link href="/login" className="btn-primary mt-8 px-5 py-2.5">
          Log in
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

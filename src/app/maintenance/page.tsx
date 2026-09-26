import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Temporarily unavailable — M.E.U.T.",
  description: "MEUT is temporarily unavailable for new signups.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div className="auth-shell !flex-col !justify-between gap-6">
      <div className="flex w-full flex-1 items-center justify-center">
        <div className="auth-card max-w-md text-center">
          <div className="mb-1 flex justify-center">
            <Image
              src="/meut-logo.png"
              alt="M.E.U.T."
              width={320}
              height={120}
              className="h-auto w-full max-w-[220px]"
              priority
            />
          </div>
          <p className="mb-1 text-sm font-medium text-slate-600">
            Medical Equipment User Tracking
          </p>
          <h1 className="mb-3 text-xl font-semibold text-slate-900">
            Temporarily unavailable
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-slate-600">
            We&apos;re pausing new signups for a short time. If you already have
            an account, you can still sign in and use MEUT as usual.
          </p>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Sign in
          </Link>
          <p className="mt-4 text-xs text-slate-500">
            Questions?{" "}
            <a
              className="font-medium text-brand-600 hover:underline"
              href="mailto:support@meut.app"
            >
              support@meut.app
            </a>
          </p>
          <p className="mt-3 text-xs text-slate-400">
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            {" · "}
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
          </p>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

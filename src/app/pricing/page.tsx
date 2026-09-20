import Link from "next/link";
import Image from "next/image";
import { PricingCards } from "@/components/billing/pricing-cards";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Pricing — M.E.U.T.",
  description: "MEUT subscription plans for biomedical / clinical engineering teams",
};

export default function PricingPage() {
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
            />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="font-semibold text-slate-600 hover:text-slate-900"
            >
              Log in
            </Link>
            <Link href="/signup" className="btn-primary px-4 py-2">
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4070D0]">
            Pricing
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Simple plans for every biomed shop
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-500">
            Facility and seat caps match your license tier. Annual billing is
            10× monthly (two months free). Extra seats are available on any plan.
          </p>
        </div>
        <PricingCards />
      </main>
      <SiteFooter />
    </div>
  );
}

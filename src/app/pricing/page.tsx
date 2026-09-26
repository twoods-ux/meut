import Link from "next/link";
import Image from "next/image";
import { PricingCards } from "@/components/billing/pricing-cards";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Pricing — M.E.U.T.",
  description: "MEUT subscription plans for biomedical / clinical engineering teams",
};

function billingNotice(search: {
  billing?: string;
  audience?: string;
  error?: string;
}): { tone: "amber" | "rose" | "slate"; text: string } | null {
  const error = (search.error || "").replace(/\s+/g, " ").trim().slice(0, 240);
  if (error) {
    return { tone: "rose", text: error };
  }
  if (search.billing === "cancel") {
    return {
      tone: "slate",
      text: "Checkout canceled. No charge was completed.",
    };
  }
  if (search.billing === "required" && search.audience === "customer") {
    return {
      tone: "amber",
      text: "Your organization needs an active subscription before the customer portal can be used. Ask a supervisor to complete billing.",
    };
  }
  if (search.billing === "required") {
    return {
      tone: "amber",
      text: "An active subscription is required to use MEUT. Payment is required before this organization can continue. Choose a plan to subscribe.",
    };
  }
  return null;
}

export default function PricingPage({
  searchParams,
}: {
  searchParams?: { billing?: string; audience?: string; error?: string };
}) {
  const notice = billingNotice(searchParams ?? {});
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
              Get started
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
            New organizations subscribe here before signup.
          </p>
        </div>
        {notice ? (
          <p
            className={
              notice.tone === "rose"
                ? "mb-8 rounded-xl bg-rose-50 px-4 py-3 text-center text-sm text-rose-800 ring-1 ring-rose-200"
                : notice.tone === "amber"
                  ? "mb-8 rounded-xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-950 ring-1 ring-amber-200"
                  : "mb-8 rounded-xl bg-slate-50 px-4 py-3 text-center text-sm text-slate-700 ring-1 ring-slate-200"
            }
          >
            {notice.text}
          </p>
        ) : null}
        <PricingCards />
      </main>
      <SiteFooter />
    </div>
  );
}

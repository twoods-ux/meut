import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
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
            <Link href="/pricing" className="font-semibold text-brand-600 hover:underline">
              Pricing
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4070D0]">
          MEUT
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        <div className="prose-legal mt-8 space-y-5 text-[15px] leading-relaxed text-slate-700">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

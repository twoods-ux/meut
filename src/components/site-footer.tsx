import Link from "next/link";

type SiteFooterProps = {
  /** Use on dark auth shells (login/signup). Default is light backgrounds. */
  variant?: "light" | "dark";
};

export function SiteFooter({ variant = "light" }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const onDark = variant === "dark";

  return (
    <footer
      className={
        onDark
          ? "relative z-10 w-full border-t border-white/10 px-4 py-5 text-center text-xs text-white/70 print:hidden"
          : "w-full border-t border-slate-200/80 bg-white px-4 py-5 text-center text-xs text-slate-500 print:hidden"
      }
      role="contentinfo"
    >
      <p className={onDark ? "font-medium text-white/85" : "font-medium text-slate-600"}>
        © {year} MEUT / Medical Equipment User Tracking. All rights reserved.
      </p>
      <p className="mx-auto mt-1 max-w-xl leading-relaxed">
        MEUT software and branding are proprietary. Unauthorized copying or
        redistribution prohibited.
      </p>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <Link
          href="/terms"
          className={
            onDark
              ? "font-semibold text-white/90 underline-offset-2 hover:underline"
              : "font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          }
        >
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          href="/privacy"
          className={
            onDark
              ? "font-semibold text-white/90 underline-offset-2 hover:underline"
              : "font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          }
        >
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <a
          href="mailto:support@meut.app"
          className={
            onDark
              ? "font-semibold text-white/90 underline-offset-2 hover:underline"
              : "font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          }
        >
          support@meut.app
        </a>
      </p>
    </footer>
  );
}

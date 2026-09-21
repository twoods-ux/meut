"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Package, ClipboardList, FileText, PlusCircle, LogOut } from "lucide-react";

const nav = [
  { href: "/portal/inventory", label: "Inventory", icon: Package },
  { href: "/portal/work-orders", label: "Work orders", icon: ClipboardList },
  { href: "/portal/work-orders/new", label: "Request CM", icon: PlusCircle },
  { href: "/portal/reports", label: "Completed reports", icon: FileText },
];

export function CustomerSidebar({
  userName,
  facilityName,
}: {
  userName?: string | null;
  facilityName?: string | null;
}) {
  const pathname = usePathname();

  function navClass(href: string) {
    const active =
      href === "/portal/work-orders"
        ? pathname === href ||
          (pathname.startsWith("/portal/work-orders/") &&
            !pathname.startsWith("/portal/work-orders/new"))
        : pathname === href || pathname.startsWith(href + "/");
    return cn(
      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
      active
        ? "bg-brand-500 text-white shadow-md shadow-brand-900/30"
        : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
    );
  }

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/5 bg-[var(--sidebar)] text-slate-100">
      <div className="border-b border-white/10 px-4 py-5">
        <Link
          href="/portal/inventory"
          className="block overflow-hidden rounded-xl bg-white p-2.5 shadow-sm transition hover:shadow-md"
        >
          <Image
            src="/meut-logo.png"
            alt="M.E.U.T. — Medical Equipment User Tracking"
            width={220}
            height={80}
            className="h-auto w-full"
            priority
          />
        </Link>
        <p className="mt-3 truncate text-center text-[11px] font-semibold tracking-wide text-brand-200">
          {facilityName || "Customer Portal"}
        </p>
        <p className="mt-1 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          Customer portal
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Navigate
        </p>
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/portal/work-orders"
              ? pathname === item.href ||
                (pathname.startsWith("/portal/work-orders/") &&
                  !pathname.startsWith("/portal/work-orders/new"))
              : pathname === item.href ||
                pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className={navClass(item.href)}>
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition",
                  active ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
          <p className="truncate text-sm font-semibold text-white">
            {userName || "Customer"}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Facility portal · request CM
          </p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-2 py-2 text-sm text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

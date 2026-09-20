"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wrench,
  Building2,
  FileText,
  Users,
  ClipboardList,
  CalendarCheck,
  BarChart3,
  Settings,
  LogOut,
  Zap,
  CircleCheck,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/equipment", label: "Equipment", icon: Wrench },
  { href: "/facilities", label: "Facilities", icon: Building2 },
  { href: "/contracts", label: "Contracts", icon: FileText },
  { href: "/technicians", label: "Technicians", icon: Users },
  { href: "/quick-entry", label: "Quick Entry", icon: Zap },
  { href: "/quick-close", label: "Quick Close", icon: CircleCheck },
  { href: "/cm-work-orders", label: "CM Work Orders", icon: ClipboardList },
  { href: "/pm-work-orders", label: "PM Work Orders", icon: CalendarCheck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function Sidebar({
  userName,
  role,
  organizationName,
}: {
  userName?: string | null;
  role?: string;
  organizationName?: string | null;
}) {
  const pathname = usePathname();

  function navClass(href: string) {
    const active = pathname === href || pathname.startsWith(href + "/");
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
          href="/dashboard"
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
        {organizationName ? (
          <p className="mt-3 truncate text-center text-[11px] font-semibold tracking-wide text-brand-200">
            {organizationName}
          </p>
        ) : (
          <p className="mt-3 text-center text-[10px] font-medium tracking-wide text-blue-200/80">
            Medical Equipment User Tracking
          </p>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Navigate
        </p>
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
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
        {role === "SUPERVISOR" && (
          <>
            <div className="my-3 border-t border-white/10" />
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Admin
            </p>
            <Link href="/settings" className={navClass("/settings")}>
              <Settings
                className={cn(
                  "h-4 w-4 shrink-0",
                  pathname === "/settings" || pathname.startsWith("/settings/")
                    ? "opacity-100"
                    : "opacity-70"
                )}
              />
              License / Settings
            </Link>
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
          <p className="truncate text-sm font-semibold text-white">
            {userName || "User"}
          </p>
          <p className="mt-0.5 text-xs capitalize text-slate-400">
            {role?.toLowerCase() || "member"}
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

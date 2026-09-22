"use client";
import { SessionProvider } from "next-auth/react";
import { IdleTimeoutWatcher } from "@/components/idle-timeout";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IdleTimeoutWatcher />
      {children}
    </SessionProvider>
  );
}

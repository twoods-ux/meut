"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

/** Sign out after this much continuous inactivity. */
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

/** Light throttle so mousemove does not thrash timer resets. */
const ACTIVITY_THROTTLE_MS = 1000;

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

/**
 * Watches for user activity while authenticated and signs out after
 * IDLE_TIMEOUT_MS of inactivity. Mount once under SessionProvider.
 */
export function IdleTimeoutWatcher() {
  const { status } = useSession();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetRef = useRef(0);
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    signingOutRef.current = false;

    const scheduleSignOut = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (signingOutRef.current) return;
        signingOutRef.current = true;
        void signOut({ callbackUrl: "/login?reason=idle" });
      }, IDLE_TIMEOUT_MS);
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastResetRef.current < ACTIVITY_THROTTLE_MS) return;
      lastResetRef.current = now;
      scheduleSignOut();
    };

    scheduleSignOut();
    lastResetRef.current = Date.now();

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true, capture: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity, { capture: true });
      }
    };
  }, [status]);

  return null;
}

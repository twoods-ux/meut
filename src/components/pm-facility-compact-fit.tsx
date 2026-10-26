"use client";

import { useEffect } from "react";
import { PM_FACILITY_COMPACT_CSS } from "@/lib/pm-facility-compact-css";
import { fitPmCompactSheets } from "@/lib/pm-facility-compact-fit";

/** Measures facility-batch sheets and shrinks any that would run past one page. */
export function PmFacilityCompactPacket({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const fit = () => fitPmCompactSheets(true);
    const onBeforePrint = () => fit();
    window.addEventListener("beforeprint", onBeforePrint);
    const media = window.matchMedia("print");
    const onMedia = () => {
      if (media.matches) fit();
    };
    media.addEventListener("change", onMedia);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      media.removeEventListener("change", onMedia);
    };
  }, []);

  return (
    <div className="pm-compact-packet">
      <style>{PM_FACILITY_COMPACT_CSS}</style>
      {children}
    </div>
  );
}

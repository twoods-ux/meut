import { MeutLogo } from "@/components/logo";

/**
 * Subtle MEUT wordmark at the bottom of a printed page.
 * Repeats on every page via fixed positioning in @media print.
 * Does not replace the organization's header logo.
 */
export function PrintWatermark() {
  return (
    <div className="print-watermark" aria-hidden="true">
      <MeutLogo
        priority
        className="print-watermark__logo h-auto w-[6.75rem] max-w-[6.75rem]"
      />
    </div>
  );
}

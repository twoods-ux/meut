/** How far to shrink a compact PM sheet so its content stays on one page. */
export function pmCompactFitScale(needed: number, available: number): number {
  if (!Number.isFinite(needed) || !Number.isFinite(available)) return 1;
  if (available <= 1 || needed <= 0) return 1;
  if (needed <= available) return 1;
  return (available - 1) / needed;
}

/**
 * Shrink each facility-batch sheet that is taller than one Letter page.
 * No-ops on screen unless `force` is set (print preview / beforeprint).
 * Uses Chrome zoom so the layout box shrinks with the content.
 */
export function fitPmCompactSheets(force = false): void {
  if (typeof document === "undefined") return;
  const printing =
    force ||
    (typeof window !== "undefined" && window.matchMedia("print").matches);
  const scales = document.querySelectorAll<HTMLElement>("[data-pm-compact-scale]");
  if (!printing) {
    scales.forEach((el) => {
      el.style.removeProperty("zoom");
    });
    return;
  }

  document.querySelectorAll<HTMLElement>("[data-pm-compact-sheet]").forEach((sheet) => {
    const scaleEl = sheet.querySelector<HTMLElement>("[data-pm-compact-scale]");
    if (!scaleEl) return;
    scaleEl.style.setProperty("zoom", "1");
    const style = getComputedStyle(sheet);
    const pad =
      (Number.parseFloat(style.paddingTop) || 0) +
      (Number.parseFloat(style.paddingBottom) || 0);
    const available = sheet.clientHeight - pad;
    const needed = scaleEl.getBoundingClientRect().height || scaleEl.scrollHeight;
    const scale = pmCompactFitScale(needed, available);
    if (scale < 1) scaleEl.style.setProperty("zoom", String(scale));
    else scaleEl.style.removeProperty("zoom");
    sheet.dataset.fitScale = scale < 1 ? scale.toFixed(3) : "1";
  });
}

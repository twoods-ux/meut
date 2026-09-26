/**
 * Temporary public freeze. Read at request time (dynamic key) so a host can
 * toggle MEUT_MAINTENANCE_MODE without rebuilding.
 * Unset, empty, or any other value is off.
 */
export function parseMaintenanceMode(raw: string | undefined): boolean {
  if (!raw) return false;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true";
}

export function isMaintenanceMode(): boolean {
  return parseMaintenanceMode(process.env["MEUT_MAINTENANCE_MODE"]);
}

export const MAINTENANCE_PUBLIC_MESSAGE =
  "MEUT is not accepting new organizations right now. Signup and online checkout are temporarily closed. If you already have an account, log in to continue.";

export const MAINTENANCE_CHECKOUT_ERROR =
  "Signup and billing are temporarily unavailable.";

/**
 * Public maintenance / “pause new signups” flag.
 *
 * Railway (meut-web): set MEUT_MAINTENANCE_MODE=1 (or true) and redeploy/restart.
 * To reopen the site: unset the variable (or set to 0/false) and redeploy/restart.
 * When unset, behavior is unchanged (site open).
 */
export function isMaintenanceMode(): boolean {
  const v = process.env.MEUT_MAINTENANCE_MODE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export const MAINTENANCE_MESSAGE =
  "MEUT is temporarily unavailable for new signups. Existing accounts can still sign in.";

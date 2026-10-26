export const PM_CLOSE_TECH_REQUIRED =
  "Select the technician who did the work.";

export const PM_CLOSE_TECH_NOT_FOUND = "Technician not found";

export type PmCloseTech = {
  id: string;
  techId: string | null;
};

/**
 * A PM close must name a technician this organization can resolve.
 * CM closes do not use this check.
 */
export async function resolvePmCloseTechnician(
  raw: unknown,
  findTech: (technicianId: string) => Promise<PmCloseTech | null>
): Promise<PmCloseTech> {
  const technicianId = String(raw ?? "").trim();
  if (!technicianId) {
    throw new Error(PM_CLOSE_TECH_REQUIRED);
  }
  const tech = await findTech(technicianId);
  if (!tech) throw new Error(PM_CLOSE_TECH_NOT_FOUND);
  return tech;
}

import { Prisma } from "@prisma/client";

export type EquipmentLookupFacility = {
  id: string;
  hospId: string;
};

/**
 * Match equipment across the whole organization inventory.
 * Control number, serial, asset/device number, and description are all searched.
 * A selected facility narrows text matches, but an exact control number is always
 * included so a hospitalId/hospId mismatch cannot hide a known control number.
 * No status filter and no row cap — callers apply take.
 */
export function equipmentLookupWhere(
  organizationId: string,
  query: string,
  facility?: EquipmentLookupFacility | null
): Prisma.EquipmentWhereInput | null {
  const q = String(query || "").trim();
  if (!q) return null;

  const text: Prisma.EquipmentWhereInput = {
    OR: [
      { controlNum: { contains: q, mode: "insensitive" } },
      { serial: { contains: q, mode: "insensitive" } },
      { deviceNum: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ],
  };

  if (!facility) {
    return { organizationId, AND: [text] };
  }

  const inFacility: Prisma.EquipmentWhereInput = {
    OR: [{ hospitalId: facility.id }, { hospId: facility.hospId }],
  };

  return {
    organizationId,
    OR: [
      { AND: [text, inFacility] },
      { controlNum: { equals: q, mode: "insensitive" } },
    ],
  };
}

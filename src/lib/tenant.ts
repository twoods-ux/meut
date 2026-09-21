import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export type OrgSession = {
  userId: string;
  organizationId: string;
  role: string;
  username?: string;
  name?: string | null;
  organizationName?: string;
  hospitalId?: string | null;
};

/** Require authenticated session with organizationId (tenant scope). */
export async function requireOrgSession(): Promise<OrgSession> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id) throw new Error("Unauthorized");
  const organizationId = user.organizationId;
  if (!organizationId) throw new Error("No organization on session");
  return {
    userId: user.id,
    organizationId,
    role: user.role ?? "TECH",
    username: user.username,
    name: user.name,
    organizationName: user.organizationName,
    hospitalId: user.hospitalId ?? null,
  };
}

/** Staff (supervisor / tech) only — customers cannot use staff routes. */
export async function requireStaffSession(): Promise<OrgSession> {
  const session = await requireOrgSession();
  if (session.role === "CUSTOMER") {
    throw new Error("Customers cannot access staff actions");
  }
  return session;
}

/** Customer portal session — must have hospital scope. */
export async function requireCustomerSession(): Promise<
  OrgSession & { hospitalId: string }
> {
  const session = await requireOrgSession();
  if (session.role !== "CUSTOMER") {
    throw new Error("Customer portal access only");
  }
  if (!session.hospitalId) {
    throw new Error("Customer account is not linked to a facility");
  }
  return { ...session, hospitalId: session.hospitalId };
}

export function isCustomer(role?: string | null): boolean {
  return role === "CUSTOMER";
}

/** Soft slug from org name for URLs / uniqueness. */
export function slugifyOrgName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "org";
}

export type CustomerFacility = {
  id: string;
  hospId: string;
  name: string;
};

/** Resolve customer's hospital (id + MediMizer facility code). */
export async function resolveCustomerFacility(
  organizationId: string,
  hospitalId: string
): Promise<CustomerFacility | null> {
  const hospital = await prisma.hospital.findFirst({
    where: { id: hospitalId, organizationId },
    select: { id: true, hospId: true, name: true },
  });
  if (!hospital) return null;
  return hospital;
}

/**
 * Equipment scoped to a customer facility.
 * Matches hospitalId FK *or* hospId facility code (MediMizer imports often
 * leave hospitalId null while setting hospId). Never broader than that facility.
 */
export function customerFacilityEquipmentWhere(
  organizationId: string,
  facility: { id: string; hospId: string },
  extra?: Prisma.EquipmentWhereInput
): Prisma.EquipmentWhereInput {
  const facilityOr: Prisma.EquipmentWhereInput = {
    OR: [{ hospitalId: facility.id }, { hospId: facility.hospId }],
  };
  if (!extra || Object.keys(extra).length === 0) {
    return { organizationId, ...facilityOr };
  }
  return {
    organizationId,
    AND: [facilityOr, extra],
  };
}

"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import {
  assertCanAddFacility,
  assertCanAddUser,
  assertCanActivateUser,
  setLicenseTier,
} from "./license-server";
import { isLicenseTier, type LicenseTier } from "./license";
import { requireStaffSession, slugifyOrgName } from "./tenant";
import { claimCheckoutSessionForOrg } from "./billing-sync";
import { isBillingInterval } from "./billing";
import {
  mergeEquipmentPrintPrefs,
  sanitizeEquipmentPrintColumns,
  type EquipmentPrintColumnId,
} from "./equipment-print-columns";
import { Prisma } from "@prisma/client";

async function nextWoNumber(organizationId: string): Promise<number> {
  const counterId = `wo:${organizationId}`;
  const existing = await prisma.counter.findUnique({ where: { id: counterId } });
  if (!existing) {
    await prisma.counter.create({ data: { id: counterId, value: 1001 } });
    return 1001;
  }
  const updated = await prisma.counter.update({
    where: { id: counterId },
    data: { value: { increment: 1 } },
  });
  return updated.value;
}

export async function createHospital(formData: FormData) {
  const { organizationId } = await requireStaffSession();
  await assertCanAddFacility(organizationId);
  const hospId = String(formData.get("hospId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!hospId || !name) throw new Error("HospID and name required");
  await prisma.hospital.create({
    data: {
      organizationId,
      hospId,
      name,
      address: String(formData.get("address") || "") || null,
      city: String(formData.get("city") || "") || null,
      state: String(formData.get("state") || "") || null,
      zip: String(formData.get("zip") || "") || null,
      phone: String(formData.get("phone") || "") || null,
    },
  });
  revalidatePath("/facilities");
}

export async function createDepartment(formData: FormData) {
  const { organizationId } = await requireStaffSession();
  const hospitalId = String(formData.get("hospitalId") || "");
  const costCtr = String(formData.get("costCtr") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const hospital = await prisma.hospital.findFirstOrThrow({
    where: { id: hospitalId, organizationId },
  });
  await prisma.department.create({
    data: {
      organizationId,
      hospitalId,
      hospId: hospital.hospId,
      costCtr,
      name,
      phone: String(formData.get("phone") || "") || null,
      manager: String(formData.get("manager") || "") || null,
    },
  });
  revalidatePath("/facilities");
}

export async function createEquipment(formData: FormData) {
  const { organizationId } = await requireStaffSession();
  const controlNum = String(formData.get("controlNum") || "").trim();
  if (!controlNum) throw new Error("Control number required");
  const hospitalId = String(formData.get("hospitalId") || "") || null;
  const departmentId = String(formData.get("departmentId") || "") || null;
  let hospId: string | null = null;
  let costCtr: string | null = null;
  if (hospitalId) {
    const h = await prisma.hospital.findFirst({
      where: { id: hospitalId, organizationId },
    });
    if (!h) throw new Error("Hospital not found");
    hospId = h.hospId;
  }
  if (departmentId) {
    const d = await prisma.department.findFirst({
      where: { id: departmentId, organizationId },
    });
    if (!d) throw new Error("Department not found");
    costCtr = d.costCtr;
  }
  await prisma.equipment.create({
    data: {
      organizationId,
      controlNum,
      serial: String(formData.get("serial") || "") || null,
      manufacturer: String(formData.get("manufacturer") || "") || null,
      model: String(formData.get("model") || "") || null,
      description: String(formData.get("description") || "") || null,
      location: String(formData.get("location") || "") || null,
      hospitalId,
      departmentId,
      hospId,
      costCtr,
      status: (String(formData.get("status") || "ACTIVE") as string) || "ACTIVE",
      onPm: formData.get("onPm") === "on" || formData.get("onPm") === "true",
      pmSchedule1: String(formData.get("pmSchedule1") || "") || null,
      pmProc1: String(formData.get("pmProc1") || "") || null,
      comments: String(formData.get("comments") || "") || null,
      risk: String(formData.get("risk") || "").trim() || null,
    },
  });
  revalidatePath("/equipment");
}

export async function updateEquipment(id: string, formData: FormData) {
  const { organizationId } = await requireStaffSession();
  const existing = await prisma.equipment.findFirst({
    where: { id, organizationId },
  });
  if (!existing) throw new Error("Equipment not found");
  const hospitalId = String(formData.get("hospitalId") || "") || null;
  const departmentId = String(formData.get("departmentId") || "") || null;
  let hospId: string | null = null;
  let costCtr: string | null = null;
  if (hospitalId) {
    const h = await prisma.hospital.findFirst({
      where: { id: hospitalId, organizationId },
    });
    if (!h) throw new Error("Hospital not found");
    hospId = h.hospId;
  }
  if (departmentId) {
    const d = await prisma.department.findFirst({
      where: { id: departmentId, organizationId },
    });
    if (!d) throw new Error("Department not found");
    costCtr = d.costCtr;
  }
  await prisma.equipment.update({
    where: { id },
    data: {
      controlNum: String(formData.get("controlNum") || "").trim(),
      serial: String(formData.get("serial") || "") || null,
      manufacturer: String(formData.get("manufacturer") || "") || null,
      model: String(formData.get("model") || "") || null,
      description: String(formData.get("description") || "") || null,
      location: String(formData.get("location") || "") || null,
      hospitalId,
      departmentId,
      hospId,
      costCtr,
      status: String(formData.get("status") || "ACTIVE") as string,
      onPm: formData.get("onPm") === "on" || formData.get("onPm") === "true",
      pmSchedule1: String(formData.get("pmSchedule1") || "") || null,
      pmProc1: String(formData.get("pmProc1") || "") || null,
      comments: String(formData.get("comments") || "") || null,
      risk: String(formData.get("risk") || "").trim() || null,
    },
  });
  revalidatePath("/equipment");
  revalidatePath(`/equipment/${id}`);
}

export async function createTechnician(formData: FormData) {
  const { organizationId } = await requireStaffSession();
  await assertCanAddUser(organizationId);
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "password");
  let role = (String(formData.get("role") || "TECH") as string) || "TECH";
  if (role === "CUSTOMER") {
    throw new Error("Use Add Customer Portal User to create customer accounts");
  }
  if (role !== "SUPERVISOR" && role !== "TECH") role = "TECH";
  const techId = String(formData.get("techId") || "") || null;
  await prisma.user.create({
    data: {
      organizationId,
      username,
      name,
      techId: techId || undefined,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      initials: String(formData.get("initials") || "") || null,
      jobTitle: String(formData.get("jobTitle") || "") || null,
    },
  });
  revalidatePath("/technicians");
}

/** Supervisor creates a read-only customer portal user linked to one hospital. */
export async function createCustomerUser(formData: FormData) {
  const { organizationId, role: actorRole } = await requireStaffSession();
  if (actorRole !== "SUPERVISOR") {
    throw new Error("Only supervisors can add customer portal users");
  }
  await assertCanAddUser(organizationId);
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const hospitalId = String(formData.get("hospitalId") || "").trim();
  if (!username || !name) throw new Error("Username and name required");
  if (password.length < 6) throw new Error("Password must be at least 6 characters");
  if (!hospitalId) throw new Error("Facility (hospital) required");

  const hospital = await prisma.hospital.findFirst({
    where: { id: hospitalId, organizationId },
  });
  if (!hospital) throw new Error("Hospital not found in your organization");

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) throw new Error("Username already taken");

  await prisma.user.create({
    data: {
      organizationId,
      username,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      role: "CUSTOMER",
      hospitalId: hospital.id,
      jobTitle: String(formData.get("jobTitle") || "Facility Contact") || "Facility Contact",
      email: String(formData.get("email") || "") || null,
      phone: String(formData.get("phone") || "") || null,
    },
  });
  revalidatePath("/technicians");
}

export async function updateTechnician(id: string, formData: FormData) {
  const { organizationId } = await requireStaffSession();
  const existing = await prisma.user.findFirst({
    where: { id, organizationId },
  });
  if (!existing) throw new Error("User not found");
  const willBeActive =
    formData.get("active") === "on" || formData.get("active") === "true";
  await assertCanActivateUser(id, willBeActive, organizationId);
  let role = String(formData.get("role") || existing.role) as string;
  let hospitalId: string | null = existing.hospitalId;
  if (role === "CUSTOMER") {
    const hid = String(formData.get("hospitalId") || existing.hospitalId || "").trim();
    if (!hid) throw new Error("Customer users must be linked to a facility");
    const hospital = await prisma.hospital.findFirst({
      where: { id: hid, organizationId },
    });
    if (!hospital) throw new Error("Hospital not found");
    hospitalId = hospital.id;
  } else {
    if (role !== "SUPERVISOR" && role !== "TECH") role = "TECH";
    hospitalId = null;
  }
  const data: Record<string, unknown> = {
    name: String(formData.get("name") || "").trim(),
    techId: role === "CUSTOMER" ? null : String(formData.get("techId") || "") || null,
    role,
    hospitalId,
    initials: String(formData.get("initials") || "") || null,
    jobTitle: String(formData.get("jobTitle") || "") || null,
    active: willBeActive,
  };
  const password = String(formData.get("password") || "");
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data });
  revalidatePath("/technicians");
}

export async function openCmWorkOrder(formData: FormData) {
  const { organizationId, userId } = await requireStaffSession();
  const equipmentId = String(formData.get("equipmentId") || "");
  const eq = await prisma.equipment.findFirstOrThrow({
    where: { id: equipmentId, organizationId },
  });
  const woNumber = await nextWoNumber(organizationId);
  const assignedTechId = String(formData.get("assignedTechId") || "") || null;
  if (assignedTechId) {
    const tech = await prisma.user.findFirst({
      where: { id: assignedTechId, organizationId },
    });
    if (!tech) throw new Error("Technician not found");
  }
  const wo = await prisma.workOrder.create({
    data: {
      organizationId,
      woNumber,
      type: "CM",
      status: "OPEN",
      equipmentId,
      controlNum: eq.controlNum,
      hospId: eq.hospId,
      costCtr: eq.costCtr,
      workRequested: String(formData.get("workRequested") || "") || null,
      priority: String(formData.get("priority") || "ROUTINE") || "ROUTINE",
      openedById: userId,
      assignedTechId,
    },
  });
  revalidatePath("/cm-work-orders");
  return wo.id;
}

export async function closeWorkOrder(id: string, formData: FormData) {
  const { organizationId, userId } = await requireStaffSession();
  const existing = await prisma.workOrder.findFirst({
    where: { id, organizationId },
  });
  if (!existing) throw new Error("Work order not found");
  const laborHours = parseFloat(String(formData.get("laborHours") || "0")) || 0;
  await prisma.workOrder.update({
    where: { id },
    data: {
      status: "CLOSED",
      dateClosed: new Date(),
      laborHours,
      workPerformed: String(formData.get("workPerformed") || "") || null,
      comments: String(formData.get("comments") || "") || null,
      closedById: userId,
    },
  });
  revalidatePath("/cm-work-orders");
  revalidatePath("/pm-work-orders");
  revalidatePath(`/cm-work-orders/${id}`);
}

export async function generatePmWorkOrders(formData: FormData) {
  const { organizationId, userId } = await requireStaffSession();
  const month = String(formData.get("month") || "").trim(); // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("month must be YYYY-MM");
  const equipment = await prisma.equipment.findMany({
    where: { organizationId, onPm: true, status: "ACTIVE" },
  });
  let created = 0;
  for (const eq of equipment) {
    const existing = await prisma.workOrder.findFirst({
      where: {
        organizationId,
        equipmentId: eq.id,
        type: "PM",
        pmMonth: month,
        status: { not: "CANCELLED" },
      },
    });
    if (existing) continue;
    const woNumber = await nextWoNumber(organizationId);
    let assignedTechId: string | null = null;
    if (eq.techAssigned1) {
      const u = await prisma.user.findFirst({
        where: { organizationId, techId: eq.techAssigned1 },
      });
      assignedTechId = u?.id ?? null;
    }
    await prisma.workOrder.create({
      data: {
        organizationId,
        woNumber,
        type: "PM",
        status: "OPEN",
        equipmentId: eq.id,
        controlNum: eq.controlNum,
        hospId: eq.hospId,
        costCtr: eq.costCtr,
        workRequested: `Scheduled PM for ${month}`,
        pmMonth: month,
        pmProc1: eq.pmProc1,
        pmSchedule1: eq.pmSchedule1,
        assignedTechCode: eq.techAssigned1,
        assignedTechId,
        openedById: userId,
      },
    });
    created++;
  }
  revalidatePath("/pm-work-orders");
  return created;
}

export async function createContract(formData: FormData) {
  const { organizationId } = await requireStaffSession();
  const contractNum = String(formData.get("contractNum") || "").trim();
  const hospitalId = String(formData.get("hospitalId") || "") || null;
  let hospId: string | null = null;
  if (hospitalId) {
    const h = await prisma.hospital.findFirst({
      where: { id: hospitalId, organizationId },
    });
    if (!h) throw new Error("Hospital not found");
    hospId = h.hospId;
  }
  const exp = String(formData.get("expirationDate") || "");
  await prisma.serviceContract.create({
    data: {
      organizationId,
      contractNum,
      name: String(formData.get("name") || "") || null,
      vendorName: String(formData.get("vendorName") || "") || null,
      hospitalId,
      hospId,
      expirationDate: exp ? new Date(exp) : null,
      contractCost: parseFloat(String(formData.get("contractCost") || "")) || null,
      coverageSummary: String(formData.get("coverageSummary") || "") || null,
      notes: String(formData.get("notes") || "") || null,
    },
  });
  revalidatePath("/contracts");
}

export async function updateLicenseTier(formData: FormData) {
  const { organizationId, role } = await requireStaffSession();
  if (role !== "SUPERVISOR") {
    throw new Error("Only supervisors can change the MEUT plan");
  }
  const tier = String(formData.get("tier") || "").trim();
  if (!isLicenseTier(tier)) throw new Error("Invalid plan tier");
  await setLicenseTier(tier, organizationId);
  revalidatePath("/settings");
  revalidatePath("/facilities");
}

/**
 * Public signup: create Organization + first SUPERVISOR user.
 * Default tier STARTER; optional trial PROFESSIONAL via form.
 */
export async function signupOrganization(formData: FormData): Promise<
  | {
      ok: true;
      organizationId: string;
      preferredTier: LicenseTier;
      preferredInterval: "MONTHLY" | "ANNUAL";
      claimedCheckout: boolean;
    }
  | { ok: false; error: string }
> {
  try {
    const orgName = String(formData.get("orgName") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const username = String(formData.get("username") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");
    const tierRaw = String(formData.get("tier") || "STARTER").trim();
    const preferredTier: LicenseTier = isLicenseTier(tierRaw) ? tierRaw : "STARTER";
    const intervalRaw = String(formData.get("interval") || "MONTHLY").trim();
    const preferredInterval = isBillingInterval(intervalRaw)
      ? intervalRaw
      : "MONTHLY";
    const checkoutSessionId = String(
      formData.get("checkoutSessionId") || ""
    ).trim();

    if (!orgName || !name || !username || password.length < 6) {
      return {
        ok: false,
        error: "Organization, name, username, and password (6+ chars) required",
      };
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return { ok: false, error: "Username already taken" };
    }

    let slug = slugifyOrgName(orgName);
    const slugTaken = await prisma.organization.findUnique({ where: { slug } });
    if (slugTaken) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Start on STARTER until Stripe webhook / claim upgrades the tier
    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          tier: checkoutSessionId ? preferredTier : "STARTER",
          active: true,
        },
      });
      await tx.user.create({
        data: {
          organizationId: created.id,
          username,
          name,
          passwordHash,
          role: "SUPERVISOR",
          techId: "SUP",
          initials: name
            .split(/\s+/)
            .map((p) => p[0])
            .join("")
            .slice(0, 3)
            .toUpperCase(),
          securityLevel: 9,
          jobTitle: "Biomed Supervisor",
        },
      });
      await tx.counter.create({
        data: { id: `wo:${created.id}`, value: 1000 },
      });
      return created;
    });

    let claimedCheckout = false;
    if (checkoutSessionId) {
      try {
        await claimCheckoutSessionForOrg(org.id, checkoutSessionId);
        claimedCheckout = true;
      } catch (claimErr) {
        console.error("[signup] claim checkout", claimErr);
      }
    }

    return {
      ok: true,
      organizationId: org.id,
      preferredTier,
      preferredInterval,
      claimedCheckout,
    };
  } catch (e) {
    console.error("[signup]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Signup failed",
    };
  }
}

export async function saveEquipmentPrintPrefs(
  columns: EquipmentPrintColumnId[]
) {
  const { userId } = await requireStaffSession();
  const sanitized = sanitizeEquipmentPrintColumns(columns);
  if (!sanitized) throw new Error("Select at least one print column");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { printPrefs: true },
  });
  if (!user) throw new Error("User not found");
  const next = mergeEquipmentPrintPrefs(user.printPrefs, sanitized);
  await prisma.user.update({
    where: { id: userId },
    data: { printPrefs: next as Prisma.InputJsonValue },
  });
  revalidatePath("/equipment");
  revalidatePath("/reports/print/equipment");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import {
  assertCanAddFacility,
  assertCanAddUser,
  assertCanActivateUser,
  setLicenseTier,
} from "./license-server";
import { isLicenseTier, type LicenseTier } from "./license";
import {
  requireStaffSession,
  requireCustomerSession,
  slugifyOrgName,
  resolveCustomerFacility,
  customerFacilityEquipmentWhere,
} from "./tenant";
import { claimCheckoutSessionForOrg } from "./billing-sync";
import { isBillingInterval } from "./billing";
import {
  mergeEquipmentPrintPrefs,
  sanitizeEquipmentPrintColumns,
  type EquipmentPrintColumnId,
} from "./equipment-print-columns";
import { Prisma } from "@prisma/client";
import {
  checklistFromFormData,
  missingRequiredPmSteps,
  normalizePmChecklist,
  parseDateInput,
  type PmChecklistItem,
} from "./pm";
import {
  isGenericOnlyChecklist,
  resolvePmProcedure,
  type PmTemplateForMatch,
} from "./pm-procedures";
import {
  buildScheduledPmWorkOrderData,
  currentPmMonth,
  parsePmMonth,
  procedureSnapshot,
  scheduledPmDuplicateWhere,
  type ScheduledPmEquipment,
} from "./pm-generate";
import {
  ensureStarterPmProcedures,
  loadMatchTemplates,
} from "./pm-procedure-store";
import { equipmentLookupWhere } from "./equipment-lookup";
import { buildWorkOrderWhere } from "./work-order-filters";
import {
  parseBulkPmDeleteForm,
  partitionPmBulkDelete,
  workOrderDeleteError,
  workOrderDeleteRefusal,
} from "./work-order-delete";
import { parseDateTimeLocal, workOrderCloseBeforeOpen } from "./utils";
import {
  resolvePmCloseTechnician,
  type PmCloseTech,
} from "./pm-close";
import {
  WORK_ORDER_REOPEN_EVENT,
  equipmentPmDatesAfterReopen,
  passClosePmStamp,
  shouldApplyPassCloseStamp,
  validateReopenRequest,
  reopenWorkOrderData,
} from "./work-order-reopen";

/** Blank or omitted uses now. A present but invalid value is rejected. */
function submittedDateTime(formData: FormData, name: string, label: string): Date {
  const raw = formData.get(name);
  if (raw == null || String(raw).trim() === "") return new Date();
  const parsed = parseDateTimeLocal(String(raw));
  if (!parsed) throw new Error(`${label} is not a valid date and time`);
  return parsed;
}

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
      techAssigned1: String(formData.get("techAssigned1") || "").trim() || null,
      pmNextDue: parseDateInput(String(formData.get("pmNextDue") || "")),
      pmLastCompleted: parseDateInput(String(formData.get("pmLastCompleted") || "")),
      pmCycleStart: parseDateInput(String(formData.get("pmCycleStart") || "")),
      comments: String(formData.get("comments") || "") || null,
      risk: String(formData.get("risk") || "").trim() || null,
    },
  });
  revalidatePath("/equipment");
  revalidatePath("/pm-work-orders");
  revalidatePath("/dashboard");
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
      techAssigned1: String(formData.get("techAssigned1") || "").trim() || null,
      pmNextDue: parseDateInput(String(formData.get("pmNextDue") || "")),
      pmLastCompleted: parseDateInput(String(formData.get("pmLastCompleted") || "")),
      pmCycleStart: parseDateInput(String(formData.get("pmCycleStart") || "")),
      comments: String(formData.get("comments") || "") || null,
      risk: String(formData.get("risk") || "").trim() || null,
    },
  });
  revalidatePath("/equipment");
  revalidatePath(`/equipment/${id}`);
  revalidatePath("/pm-work-orders");
  revalidatePath("/dashboard");
}

export type FormActionResult = { ok: true } | { ok: false; error: string };

function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function redirectTechnicians(opts: { error?: string; created?: string }) {
  const params = new URLSearchParams();
  if (opts.error) params.set("error", opts.error.slice(0, 300));
  if (opts.created) params.set("created", opts.created);
  const q = params.toString();
  redirect(q ? `/technicians?${q}` : "/technicians");
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

/**
 * Supervisor creates a customer portal user linked to one hospital.
 * Returns a result instead of throwing so production does not show Application error.
 */
export async function createCustomerUser(
  formData: FormData
): Promise<FormActionResult> {
  try {
    const { organizationId, role: actorRole } = await requireStaffSession();
    if (actorRole !== "SUPERVISOR") {
      return {
        ok: false,
        error: "Only supervisors can add customer portal users",
      };
    }

    try {
      await assertCanAddUser(organizationId);
    } catch (error) {
      return {
        ok: false,
        error: actionErrorMessage(error, "Seat limit reached. Upgrade your plan."),
      };
    }

    const username = String(formData.get("username") || "").trim().toLowerCase();
    const name = String(formData.get("name") || "").trim();
    const password = String(formData.get("password") || "");
    const hospitalId = String(formData.get("hospitalId") || "").trim();
    if (!username || !name) {
      return { ok: false, error: "Username and name are required" };
    }
    if (!/^[a-z0-9._-]{2,64}$/.test(username)) {
      return {
        ok: false,
        error:
          "Username must be 2–64 characters (letters, numbers, . _ - only)",
      };
    }
    if (password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters" };
    }
    if (!hospitalId) {
      return { ok: false, error: "Select a facility for this customer user" };
    }

    const hospital = await prisma.hospital.findFirst({
      where: { id: hospitalId, organizationId },
    });
    if (!hospital) {
      return { ok: false, error: "Hospital not found in your organization" };
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return { ok: false, error: "Username already taken — choose another" };
    }

    const emailRaw = String(formData.get("email") || "").trim();
    const email = emailRaw || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Enter a valid email address or leave it blank" };
    }

    await prisma.user.create({
      data: {
        organizationId,
        username,
        name,
        passwordHash: await bcrypt.hash(password, 10),
        role: "CUSTOMER",
        hospitalId: hospital.id,
        jobTitle:
          String(formData.get("jobTitle") || "Facility Contact").trim() ||
          "Facility Contact",
        email,
        phone: String(formData.get("phone") || "").trim() || null,
      },
    });
    revalidatePath("/technicians");
    return { ok: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "Username already taken — choose another" };
    }
    console.error("createCustomerUser failed", error);
    return {
      ok: false,
      error: actionErrorMessage(
        error,
        "Could not create customer portal user. Please try again."
      ),
    };
  }
}

/** Form action for Technicians → Add Customer Portal User (friendly redirect UX). */
export async function createCustomerUserAction(formData: FormData) {
  const result = await createCustomerUser(formData);
  if (!result.ok) {
    redirectTechnicians({ error: result.error });
  }
  redirectTechnicians({ created: "customer" });
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
  const dateOpened = submittedDateTime(formData, "dateOpened", "Opened date");

  let equipmentId = String(formData.get("equipmentId") || "").trim();
  const controlNumRaw = String(formData.get("controlNum") || "").trim();
  if (!equipmentId && controlNumRaw) {
    const exact = await prisma.equipment.findMany({
      where: {
        organizationId,
        controlNum: { equals: controlNumRaw, mode: "insensitive" },
      },
      take: 2,
    });
    if (exact.length === 1) {
      equipmentId = exact[0].id;
    } else if (exact.length > 1) {
      throw new Error(
        "Multiple equipment share that control number — pick one from the list"
      );
    } else {
      const where = equipmentLookupWhere(organizationId, controlNumRaw);
      const broader = where
        ? await prisma.equipment.findMany({ where, take: 2 })
        : [];
      if (broader.length === 1) {
        equipmentId = broader[0].id;
      } else if (broader.length > 1) {
        throw new Error(
          `Several equipment match "${controlNumRaw}" — pick one from the list`
        );
      } else {
        throw new Error(`Equipment not found for "${controlNumRaw}"`);
      }
    }
  }
  if (!equipmentId) throw new Error("Equipment or Control # is required");
  const eq = await prisma.equipment.findFirst({
    where: { id: equipmentId, organizationId },
  });
  if (!eq) throw new Error("Equipment not found");
  const workRequested = String(formData.get("workRequested") || "").trim();
  if (!workRequested) throw new Error("Problem / description is required");
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
      workRequested,
      priority: String(formData.get("priority") || "ROUTINE") || "ROUTINE",
      openedById: userId,
      assignedTechId,
      dateOpened,
    },
  });
  revalidatePath("/cm-work-orders");
  revalidatePath("/quick-entry");
  return { id: wo.id, woNumber: wo.woNumber, controlNum: eq.controlNum };
}

/** Customer portal: open a CM work order for equipment at their facility only. */
export async function createCustomerCmWorkOrder(
  formData: FormData
): Promise<
  | { ok: true; id: string; woNumber: number; controlNum: string }
  | { ok: false; error: string }
> {
  try {
    const { organizationId, userId, hospitalId } = await requireCustomerSession();
    const equipmentId = String(formData.get("equipmentId") || "").trim();
    if (!equipmentId) {
      return { ok: false, error: "Select a Control # for this CM request" };
    }

    const facility = await resolveCustomerFacility(organizationId, hospitalId);
    if (!facility) {
      return {
        ok: false,
        error: "Your account is not linked to a valid facility",
      };
    }

    const eq = await prisma.equipment.findFirst({
      where: customerFacilityEquipmentWhere(organizationId, facility, {
        id: equipmentId,
      }),
    });
    if (!eq) {
      return {
        ok: false,
        error:
          "That Control # was not found at your facility. Pick equipment from the list.",
      };
    }

    const workRequested = String(formData.get("workRequested") || "").trim();
    if (!workRequested) {
      return {
        ok: false,
        error: `Problem / description is required for Control # ${eq.controlNum}`,
      };
    }

    const priorityRaw = String(formData.get("priority") || "ROUTINE")
      .trim()
      .toUpperCase();
    const allowedPriorities = new Set(["STAT", "URGENT", "ROUTINE"]);
    const priority = allowedPriorities.has(priorityRaw) ? priorityRaw : "ROUTINE";

    const woNumber = await nextWoNumber(organizationId);
    const wo = await prisma.workOrder.create({
      data: {
        organizationId,
        woNumber,
        type: "CM",
        status: "OPEN",
        equipmentId: eq.id,
        controlNum: eq.controlNum,
        hospId: eq.hospId,
        costCtr: eq.costCtr,
        workRequested,
        priority,
        openedById: userId,
      },
    });

    revalidatePath("/portal/work-orders");
    revalidatePath("/portal/reports");
    revalidatePath("/cm-work-orders");
    return {
      ok: true,
      id: wo.id,
      woNumber: wo.woNumber,
      controlNum: eq.controlNum,
    };
  } catch (error) {
    console.error("createCustomerCmWorkOrder failed", error);
    return {
      ok: false,
      error: actionErrorMessage(
        error,
        "Could not submit CM request. Please try again."
      ),
    };
  }
}

function redirectCustomerNewCm(opts: {
  error?: string;
  equipmentId?: string;
}) {
  const params = new URLSearchParams();
  if (opts.error) params.set("error", opts.error.slice(0, 300));
  if (opts.equipmentId) params.set("equipmentId", opts.equipmentId);
  const q = params.toString();
  redirect(q ? `/portal/work-orders/new?${q}` : "/portal/work-orders/new");
}

/** Form action for portal Request CM (friendly redirect UX, no bare throws). */
export async function createCustomerCmWorkOrderAction(formData: FormData) {
  const equipmentId = String(formData.get("equipmentId") || "").trim();
  const result = await createCustomerCmWorkOrder(formData);
  if (!result.ok) {
    redirectCustomerNewCm({
      error: result.error,
      equipmentId: equipmentId || undefined,
    });
  } else {
    redirect(
      `/portal/work-orders/${result.id}?created=1&controlNum=${encodeURIComponent(result.controlNum)}`
    );
  }
}

/**
 * Typeahead for opening a CM. Searches control number, serial, asset/device
 * number, and description across the whole inventory (not a preloaded slice).
 * An exact control number is returned even when hospitalId/hospId do not match
 * the selected facility.
 */
export async function lookupEquipmentByControlNum(
  query: string,
  facilityId?: string
) {
  const { organizationId } = await requireStaffSession();
  const q = String(query || "").trim();
  if (!q) return [];
  const rawFacilityId = String(facilityId || "").trim();
  let facility: { id: string; hospId: string } | null = null;
  if (rawFacilityId && rawFacilityId !== "ALL") {
    const hospital = await prisma.hospital.findFirst({
      where: { id: rawFacilityId, organizationId },
      select: { id: true, hospId: true },
    });
    if (!hospital) throw new Error("Hospital not found");
    facility = hospital;
  }
  const where = equipmentLookupWhere(organizationId, q, facility);
  if (!where) return [];
  const matches = await prisma.equipment.findMany({
    where,
    select: {
      id: true,
      controlNum: true,
      description: true,
      manufacturer: true,
      model: true,
      serial: true,
      deviceNum: true,
      location: true,
      hospId: true,
    },
    orderBy: { controlNum: "asc" },
    take: 25,
  });
  matches.sort((a, b) => {
    const aExact = a.controlNum.toLowerCase() === q.toLowerCase() ? 0 : 1;
    const bExact = b.controlNum.toLowerCase() === q.toLowerCase() ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return a.controlNum.localeCompare(b.controlNum);
  });
  return matches;
}

/** Find OPEN CM/PM work orders by WO # and/or Control # (org-scoped). */
export async function findOpenWorkOrders(opts: {
  woNumber?: string;
  controlNum?: string;
}) {
  const { organizationId } = await requireStaffSession();
  const woRaw = String(opts.woNumber || "").trim();
  const controlRaw = String(opts.controlNum || "").trim();
  if (!woRaw && !controlRaw) {
    throw new Error("Enter a WO # and/or Control #");
  }
  const where: Prisma.WorkOrderWhereInput = {
    organizationId,
    status: "OPEN",
  };
  if (woRaw) {
    const n = parseInt(woRaw, 10);
    if (Number.isNaN(n)) throw new Error("WO # must be a number");
    where.woNumber = n;
  }
  if (controlRaw) {
    where.OR = [
      { controlNum: { equals: controlRaw, mode: "insensitive" } },
      { equipment: { controlNum: { equals: controlRaw, mode: "insensitive" } } },
    ];
  }
  return prisma.workOrder.findMany({
    where,
    include: {
      equipment: { select: { id: true, controlNum: true, description: true, model: true } },
      assignedTech: { select: { id: true, name: true, techId: true } },
    },
    orderBy: { woNumber: "desc" },
    take: 50,
  });
}

export async function closeWorkOrder(id: string, formData: FormData) {
  const { organizationId, userId } = await requireStaffSession();
  const existing = await prisma.workOrder.findFirst({
    where: { id, organizationId },
    include: { equipment: true },
  });
  if (!existing) throw new Error("Work order not found");
  const laborHours = parseFloat(String(formData.get("laborHours") || "0")) || 0;
  const rawPmResult = String(formData.get("pmResult") || "")
    .trim()
    .toUpperCase();
  let pmResult: string | null = null;
  let pmChecklist: PmChecklistItem[] | undefined;
  let procedureMeta: ReturnType<typeof procedureSnapshot> | null = null;
  let closeTech: PmCloseTech | null = null;
  if (existing.type === "PM") {
    if (rawPmResult !== "PASS" && rawPmResult !== "FAIL") {
      throw new Error("Pass or Fail is required when closing a PM work order");
    }
    pmResult = rawPmResult;
    closeTech = await resolvePmCloseTechnician(
      formData.get("assignedTechId"),
      (technicianId) =>
        prisma.user.findFirst({
          where: {
            id: technicianId,
            organizationId,
            active: true,
            role: { in: ["TECH", "SUPERVISOR"] },
          },
          select: { id: true, techId: true },
        })
    );
    const current = normalizePmChecklist(existing.pmChecklist);
    let seeded = current;
    if (current.length === 0 || isGenericOnlyChecklist(current)) {
      const templates = await loadMatchTemplates(prisma, organizationId);
      const resolved = resolvePmProcedure(
        {
          pmProc1: existing.pmProc1 || existing.equipment.pmProc1,
          description: existing.equipment.description,
          manufacturer: existing.equipment.manufacturer,
          model: existing.equipment.model,
          pmTemplateId: existing.equipment.pmTemplateId,
        },
        templates
      );
      if (current.length === 0 || resolved.source !== "GENERIC") {
        seeded = resolved.items;
        procedureMeta = procedureSnapshot(resolved);
      }
    }
    pmChecklist = checklistFromFormData(formData, seeded);
    const missing = missingRequiredPmSteps(pmChecklist);
    if (missing.length > 0) {
      throw new Error(missing.slice(0, 4).join("; "));
    }
  }
  const dateClosed = submittedDateTime(formData, "dateClosed", "Closed date");
  if (workOrderCloseBeforeOpen(existing.dateOpened, dateClosed)) {
    throw new Error("Closed date cannot be before the opened date");
  }
  await prisma.workOrder.update({
    where: { id },
    data: {
      status: "CLOSED",
      dateClosed,
      laborHours,
      workPerformed: String(formData.get("workPerformed") || "") || null,
      comments: String(formData.get("comments") || "") || null,
      closedById: userId,
      ...(closeTech
        ? {
            assignedTechId: closeTech.id,
            assignedTechCode: closeTech.techId,
          }
        : {}),
      pmResult,
      ...(pmChecklist
        ? { pmChecklist: pmChecklist as unknown as Prisma.InputJsonValue }
        : {}),
      ...(procedureMeta
        ? {
            pmProcedureSource: procedureMeta.pmProcedureSource,
            pmTemplateId: procedureMeta.pmTemplateId,
            pmTemplateName: procedureMeta.pmTemplateName,
            pmTemplateVersion: procedureMeta.pmTemplateVersion,
          }
        : {}),
    },
  });

  // On Pass: stamp last completed and next due from this close date (one interval).
  // A later Pass replaces that stamp. Re-closing an older PM does not move the
  // stamp backward and does not add another interval on top of it.
  if (existing.type === "PM" && pmResult === "PASS") {
    const schedule =
      existing.pmSchedule1 || existing.equipment.pmSchedule1 || null;
    if (
      shouldApplyPassCloseStamp(dateClosed, existing.equipment.pmLastCompleted)
    ) {
      await prisma.equipment.update({
        where: { id: existing.equipmentId },
        data: passClosePmStamp(dateClosed, schedule),
      });
    }
  }

  revalidatePath("/cm-work-orders");
  revalidatePath("/pm-work-orders");
  revalidatePath(`/cm-work-orders/${id}`);
  revalidatePath(`/pm-work-orders/${id}`);
  revalidatePath(`/pm-work-orders/${id}/print`);
  revalidatePath(`/equipment/${existing.equipmentId}`);
  revalidatePath("/equipment");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/quick-close");
  revalidatePath("/quick-entry");
}

/**
 * Supervisor-only: return a CLOSED PM or CM work order to OPEN.
 * Clears the close date and overall pass/fail result. Checklist steps,
 * readings, and notes stay so they can be corrected and closed again.
 * Records who reopened it, when, and why.
 */
export async function reopenWorkOrder(
  id: string,
  formData: FormData
): Promise<FormActionResult> {
  try {
    const session = await requireStaffSession();
    const actor = await prisma.user.findFirst({
      where: { id: session.userId, organizationId: session.organizationId },
      select: { role: true },
    });
    const role =
      session.role === "SUPERVISOR" && actor?.role === "SUPERVISOR"
        ? "SUPERVISOR"
        : "TECH";
    if (role !== "SUPERVISOR") {
      return {
        ok: false,
        error: "Only supervisors can reopen a closed work order",
      };
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.workOrder.findFirst({
        where: { id, organizationId: session.organizationId },
        include: {
          equipment: {
            select: {
              id: true,
              pmSchedule1: true,
              pmLastCompleted: true,
              pmNextDue: true,
            },
          },
        },
      });
      const decision = validateReopenRequest({
        role,
        sessionOrganizationId: session.organizationId,
        workOrder: existing
          ? {
              organizationId: existing.organizationId,
              type: existing.type,
              status: existing.status,
            }
          : null,
        reason: String(formData.get("reason") || ""),
        confirmed: formData.get("confirmReopen") === "yes",
      });
      if (!decision.ok) return decision;
      if (!existing) {
        return { ok: false as const, error: "Work order not found" };
      }

      const schedule = existing.pmSchedule1 || existing.equipment.pmSchedule1 || null;
      let equipmentUpdate: {
        pmLastCompleted: Date | null;
        pmNextDue: Date | null;
      } | null = null;
      if (existing.type === "PM" && existing.pmResult === "PASS" && existing.dateClosed) {
        const others = await tx.workOrder.findMany({
          where: {
            organizationId: session.organizationId,
            equipmentId: existing.equipmentId,
            type: "PM",
            status: "CLOSED",
            pmResult: "PASS",
            id: { not: existing.id },
            NOT: { dateClosed: null },
          },
          select: { dateClosed: true, pmSchedule1: true },
        });
        const dates = equipmentPmDatesAfterReopen({
          type: existing.type,
          pmResult: existing.pmResult,
          dateClosed: existing.dateClosed,
          schedule,
          current: {
            pmLastCompleted: existing.equipment.pmLastCompleted,
            pmNextDue: existing.equipment.pmNextDue,
          },
          otherPassCloses: others.flatMap((row) =>
            row.dateClosed
              ? [
                  {
                    dateClosed: row.dateClosed,
                    schedule: row.pmSchedule1 || existing.equipment.pmSchedule1 || null,
                  },
                ]
              : []
          ),
        });
        if (dates.changed) equipmentUpdate = dates.next;
      }

      const updated = await tx.workOrder.updateMany({
        where: {
          id: existing.id,
          organizationId: session.organizationId,
          status: "CLOSED",
        },
        data: reopenWorkOrderData(),
      });
      if (updated.count !== 1) {
        return { ok: false as const, error: "Work order is no longer closed" };
      }

      await tx.workOrderEvent.create({
        data: {
          organizationId: session.organizationId,
          workOrderId: existing.id,
          type: WORK_ORDER_REOPEN_EVENT,
          actorId: session.userId,
          reason: decision.reason,
        },
      });

      if (equipmentUpdate) {
        await tx.equipment.update({
          where: { id: existing.equipmentId },
          data: equipmentUpdate,
        });
      }

      return {
        ok: true as const,
        equipmentId: existing.equipmentId,
        type: existing.type,
      };
    });

    if (!outcome.ok) return outcome;

    revalidatePath("/cm-work-orders");
    revalidatePath("/pm-work-orders");
    revalidatePath(`/cm-work-orders/${id}`);
    revalidatePath(`/pm-work-orders/${id}`);
    revalidatePath(`/cm-work-orders/${id}/print`);
    revalidatePath(`/pm-work-orders/${id}/print`);
    revalidatePath(`/equipment/${outcome.equipmentId}`);
    revalidatePath("/equipment");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/reports/print/cm");
    revalidatePath("/reports/print/pm");
    revalidatePath("/quick-close");
    revalidatePath("/quick-entry");
    revalidatePath("/portal/work-orders");
    revalidatePath(`/portal/work-orders/${id}`);
    revalidatePath("/portal/reports");
    revalidatePath("/portal/inventory");
    revalidatePath(`/portal/inventory/${outcome.equipmentId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: actionErrorMessage(error, "Could not reopen work order"),
    };
  }
}

/**
 * Staff-only: correct a CM or PM work order's opened date, and its closed
 * date when the order is already closed. Does not change status.
 * Close may equal open; it cannot be earlier.
 */
export async function updateWorkOrderDates(
  id: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { organizationId } = await requireStaffSession();
    const existing = await prisma.workOrder.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        type: true,
        status: true,
        equipmentId: true,
      },
    });
    if (!existing) {
      return { ok: false, error: "Work order not found" };
    }
    if (existing.type !== "CM" && existing.type !== "PM") {
      return { ok: false, error: "Only CM or PM work orders can be updated" };
    }

    const dateOpened = parseDateTimeLocal(String(formData.get("dateOpened") || ""));
    if (!dateOpened) {
      return { ok: false, error: "Opened date and time are required" };
    }

    const isClosed = existing.status === "CLOSED";
    let dateClosed: Date | null = null;
    if (isClosed) {
      dateClosed = parseDateTimeLocal(String(formData.get("dateClosed") || ""));
      if (!dateClosed) {
        return { ok: false, error: "Closed date and time are required" };
      }
      if (workOrderCloseBeforeOpen(dateOpened, dateClosed)) {
        return {
          ok: false,
          error: "Closed date cannot be before the opened date",
        };
      }
    }

    await prisma.workOrder.update({
      where: { id: existing.id },
      data: {
        dateOpened,
        ...(isClosed ? { dateClosed } : {}),
      },
    });

    revalidatePath("/cm-work-orders");
    revalidatePath("/pm-work-orders");
    revalidatePath(`/cm-work-orders/${id}`);
    revalidatePath(`/pm-work-orders/${id}`);
    revalidatePath(`/cm-work-orders/${id}/print`);
    revalidatePath(`/pm-work-orders/${id}/print`);
    revalidatePath(`/equipment/${existing.equipmentId}`);
    revalidatePath("/equipment");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/reports/print/cm");
    revalidatePath("/reports/print/pm");
    revalidatePath("/portal/work-orders");
    revalidatePath(`/portal/work-orders/${id}`);
    revalidatePath("/portal/reports");
    revalidatePath("/portal/inventory");
    revalidatePath(`/portal/inventory/${existing.equipmentId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: actionErrorMessage(error, "Could not update work order dates"),
    };
  }
}

/** Persist PM checklist step results without closing the work order. */
export async function savePmChecklist(id: string, formData: FormData) {
  const { organizationId } = await requireStaffSession();
  const existing = await prisma.workOrder.findFirst({
    where: { id, organizationId, type: "PM" },
    include: { equipment: true },
  });
  if (!existing) throw new Error("PM work order not found");
  if (existing.status !== "OPEN") {
    throw new Error("Checklist can only be edited on open PM work orders");
  }
  const current = normalizePmChecklist(existing.pmChecklist);
  let seeded = current;
  let procedureMeta: ReturnType<typeof procedureSnapshot> | null = null;
  if (current.length === 0 || isGenericOnlyChecklist(current)) {
    const templates = await loadMatchTemplates(prisma, organizationId);
    const resolved = resolvePmProcedure(
      {
        pmProc1: existing.pmProc1 || existing.equipment.pmProc1,
        description: existing.equipment.description,
        manufacturer: existing.equipment.manufacturer,
        model: existing.equipment.model,
        pmTemplateId: existing.equipment.pmTemplateId,
      },
      templates
    );
    if (current.length === 0 || resolved.source !== "GENERIC") {
      seeded = resolved.items;
      procedureMeta = procedureSnapshot(resolved);
    }
  }
  const pmChecklist = checklistFromFormData(formData, seeded);
  await prisma.workOrder.update({
    where: { id },
    data: {
      pmChecklist: pmChecklist as unknown as Prisma.InputJsonValue,
      ...(procedureMeta
        ? {
            pmProcedureSource: procedureMeta.pmProcedureSource,
            pmTemplateId: procedureMeta.pmTemplateId,
            pmTemplateName: procedureMeta.pmTemplateName,
            pmTemplateVersion: procedureMeta.pmTemplateVersion,
          }
        : {}),
    },
  });
  revalidatePath(`/pm-work-orders/${id}`);
  revalidatePath(`/pm-work-orders/${id}/print`);
  revalidatePath("/pm-work-orders");
}

/**
 * Re-snapshot an OPEN PM work order's checklist from the equipment's current
 * procedure (custom text, pinned template, best library match, generic step).
 * Discards any step results already recorded on the open work order.
 */
export async function refreshPmProcedure(id: string) {
  const { organizationId } = await requireStaffSession();
  const existing = await prisma.workOrder.findFirst({
    where: { id, organizationId, type: "PM" },
    include: { equipment: true },
  });
  if (!existing) throw new Error("PM work order not found");
  if (existing.status !== "OPEN") {
    throw new Error("Only open PM work orders can refresh their procedure");
  }
  const templates = await loadMatchTemplates(prisma, organizationId);
  const resolved = resolvePmProcedure(
    {
      pmProc1: existing.pmProc1 || existing.equipment.pmProc1,
      description: existing.equipment.description,
      manufacturer: existing.equipment.manufacturer,
      model: existing.equipment.model,
      pmTemplateId: existing.equipment.pmTemplateId,
    },
    templates
  );
  const snapshot = procedureSnapshot(resolved);
  await prisma.workOrder.update({
    where: { id },
    data: {
      pmChecklist: snapshot.pmChecklist,
      pmProcedureSource: snapshot.pmProcedureSource,
      pmTemplateId: snapshot.pmTemplateId,
      pmTemplateName: snapshot.pmTemplateName,
      pmTemplateVersion: snapshot.pmTemplateVersion,
    },
  });
  revalidatePath(`/pm-work-orders/${id}`);
  revalidatePath(`/pm-work-orders/${id}/print`);
  revalidatePath("/pm-work-orders");
  return { source: resolved.source, templateName: resolved.templateName };
}

/**
 * Staff-only: delete an OPEN PM or CM work order (e.g. accidental PM generate).
 * Never deletes CLOSED WOs or the related equipment record.
 * Returns a result so callers can redirect with a friendly banner (no Application error).
 */
export async function deleteOpenWorkOrder(
  id: string
): Promise<
  | { ok: true; type: string; woNumber: number }
  | { ok: false; error: string }
> {
  try {
    const { organizationId } = await requireStaffSession();
    const existing = await prisma.workOrder.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        type: true,
        status: true,
        woNumber: true,
        equipmentId: true,
      },
    });
    const refusal = workOrderDeleteRefusal(existing);
    if (refusal || !existing) {
      return { ok: false, error: workOrderDeleteError(refusal ?? "not_found") };
    }
    await prisma.workOrder.delete({ where: { id: existing.id } });
    revalidatePath("/pm-work-orders");
    revalidatePath("/cm-work-orders");
    revalidatePath(`/pm-work-orders/${id}`);
    revalidatePath(`/cm-work-orders/${id}`);
    revalidatePath(`/equipment/${existing.equipmentId}`);
    revalidatePath("/equipment");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/quick-close");
    return {
      ok: true,
      type: existing.type,
      woNumber: existing.woNumber,
    };
  } catch (error) {
    return {
      ok: false,
      error: actionErrorMessage(error, "Could not delete work order"),
    };
  }
}

export type DeleteSelectedPmResult =
  | {
      ok: true;
      deleted: number;
      skippedClosed: number;
      skippedOther: number;
    }
  | { ok: false; error: string };

/**
 * Staff-only: delete the selected OPEN PM work orders in this organization.
 * Closed PMs are left in place and counted as skipped. Equipment is not deleted.
 * `selection=filter` is every PM matching the list filter (all pages), minus exclusions.
 */
export async function deleteSelectedPmWorkOrders(
  formData: FormData
): Promise<DeleteSelectedPmResult> {
  try {
    const { organizationId } = await requireStaffSession();
    const parsed = parseBulkPmDeleteForm(formData);
    if (!parsed.ok) return parsed;

    let rows: Array<{
      id: string;
      type: string;
      status: string;
      equipmentId: string;
    }> = [];
    let missing = 0;

    if (parsed.request.selection === "ids") {
      rows = await prisma.workOrder.findMany({
        where: {
          id: { in: parsed.request.ids },
          organizationId,
        },
        select: { id: true, type: true, status: true, equipmentId: true },
      });
      const found = new Set(rows.map((row) => row.id));
      missing = parsed.request.ids.filter((id) => !found.has(id)).length;
    } else {
      const where = buildWorkOrderWhere(
        organizationId,
        "PM",
        parsed.request.filters
      );
      const matched = await prisma.workOrder.findMany({
        where,
        select: { id: true, type: true, status: true, equipmentId: true },
      });
      const excluded = new Set(parsed.request.excludeIds);
      rows = matched.filter((row) => !excluded.has(row.id));
    }

    const plan = partitionPmBulkDelete(rows);
    let deleted = 0;
    if (plan.deletable.length > 0) {
      const result = await prisma.workOrder.deleteMany({
        where: {
          id: { in: plan.deletable.map((row) => row.id) },
          organizationId,
          type: "PM",
          status: "OPEN",
        },
      });
      deleted = result.count;
    }
    const noLongerOpen = plan.deletable.length - deleted;
    const skippedClosed = plan.skippedClosed.length + noLongerOpen;
    const skippedOther = plan.skippedOther.length + missing;
    if (deleted === 0 && skippedClosed === 0 && skippedOther === 0) {
      return { ok: false, error: "Select at least one PM work order" };
    }

    revalidatePath("/pm-work-orders");
    revalidatePath("/cm-work-orders");
    revalidatePath("/equipment");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/quick-close");
    const equipmentIds = new Set<string>();
    for (const row of plan.deletable) {
      revalidatePath(`/pm-work-orders/${row.id}`);
      equipmentIds.add(row.equipmentId);
    }
    for (const equipmentId of Array.from(equipmentIds)) {
      revalidatePath(`/equipment/${equipmentId}`);
    }

    return { ok: true, deleted, skippedClosed, skippedOther };
  } catch (error) {
    return {
      ok: false,
      error: actionErrorMessage(error, "Could not delete work orders"),
    };
  }
}

/**
 * Create one scheduled PM when this equipment does not already have one for
 * the month. Bulk generate and the single-equipment action both use this.
 */
async function createScheduledPmWorkOrder(input: {
  organizationId: string;
  userId: string;
  equipment: ScheduledPmEquipment;
  month: string;
  dateOpened: Date;
  templates: PmTemplateForMatch[];
}): Promise<
  | { created: true; id: string; woNumber: number }
  | {
      created: false;
      existing: { id: string; woNumber: number; pmMonth: string | null };
    }
> {
  const existing = await prisma.workOrder.findFirst({
    where: scheduledPmDuplicateWhere(
      input.organizationId,
      input.equipment.id,
      input.month
    ),
    select: { id: true, woNumber: true, pmMonth: true },
    orderBy: { woNumber: "desc" },
  });
  if (existing) return { created: false, existing };

  let assignedTechId: string | null = null;
  if (input.equipment.techAssigned1) {
    const tech = await prisma.user.findFirst({
      where: {
        organizationId: input.organizationId,
        techId: input.equipment.techAssigned1,
      },
      select: { id: true },
    });
    assignedTechId = tech?.id ?? null;
  }
  const resolved = resolvePmProcedure(
    {
      pmProc1: input.equipment.pmProc1,
      description: input.equipment.description,
      manufacturer: input.equipment.manufacturer,
      model: input.equipment.model,
      pmTemplateId: input.equipment.pmTemplateId,
    },
    input.templates
  );
  const woNumber = await nextWoNumber(input.organizationId);
  const wo = await prisma.workOrder.create({
    data: buildScheduledPmWorkOrderData({
      organizationId: input.organizationId,
      woNumber,
      equipment: input.equipment,
      month: input.month,
      dateOpened: input.dateOpened,
      openedById: input.userId,
      assignedTechId,
      resolved,
    }),
  });
  return { created: true, id: wo.id, woNumber: wo.woNumber };
}

export type GenerateEquipmentPmResult =
  | {
      ok: true;
      id: string;
      woNumber: number;
      pmMonth: string;
      controlNum: string;
    }
  | {
      ok: false;
      duplicate: true;
      id: string;
      woNumber: number;
      pmMonth: string;
      controlNum: string;
    }
  | { ok: false; error: string };

/**
 * Staff-only: one PM work order for one piece of equipment in this org.
 * Month defaults to the current month. Opened date defaults to now.
 * A PM already on file for that month is returned instead of creating another.
 */
export async function generateEquipmentPmWorkOrder(
  formData: FormData
): Promise<GenerateEquipmentPmResult> {
  try {
    const { organizationId, userId } = await requireStaffSession();
    const equipmentId = String(formData.get("equipmentId") || "").trim();
    if (!equipmentId) return { ok: false, error: "Equipment is required" };

    const monthRaw = String(formData.get("month") || "").trim();
    const month = parsePmMonth(monthRaw || currentPmMonth());
    if (!month) return { ok: false, error: "Month must be YYYY-MM" };

    let dateOpened: Date;
    try {
      dateOpened = submittedDateTime(formData, "dateOpened", "Opened date");
    } catch (error) {
      return {
        ok: false,
        error: actionErrorMessage(error, "Opened date is not a valid date and time"),
      };
    }

    const equipment = await prisma.equipment.findFirst({
      where: { id: equipmentId, organizationId },
    });
    if (!equipment) return { ok: false, error: "Equipment not found" };

    const templates = await loadMatchTemplates(prisma, organizationId);
    const outcome = await createScheduledPmWorkOrder({
      organizationId,
      userId,
      equipment,
      month,
      dateOpened,
      templates,
    });

    if (!outcome.created) {
      return {
        ok: false,
        duplicate: true,
        id: outcome.existing.id,
        woNumber: outcome.existing.woNumber,
        pmMonth: outcome.existing.pmMonth || month,
        controlNum: equipment.controlNum,
      };
    }

    revalidatePath("/pm-work-orders");
    revalidatePath(`/pm-work-orders/${outcome.id}`);
    revalidatePath("/dashboard");
    revalidatePath("/equipment");
    revalidatePath(`/equipment/${equipment.id}`);
    return {
      ok: true,
      id: outcome.id,
      woNumber: outcome.woNumber,
      pmMonth: month,
      controlNum: equipment.controlNum,
    };
  } catch (error) {
    return {
      ok: false,
      error: actionErrorMessage(error, "Could not generate PM work order"),
    };
  }
}

export async function generatePmWorkOrders(formData: FormData) {
  const { organizationId, userId } = await requireStaffSession();
  const month = parsePmMonth(formData.get("month"));
  if (!month) throw new Error("month must be YYYY-MM");
  const dateOpened = submittedDateTime(formData, "dateOpened", "Opened date");

  // Accept both names so callers can use the same facility value as the list
  // filters or the model field name. "ALL" (and an omitted value) means no
  // facility restriction.
  const facilityValue = String(
    formData.get("facility") || formData.get("hospitalId") || ""
  ).trim();
  const facilityId =
    facilityValue && facilityValue !== "ALL" ? facilityValue : null;
  let equipmentWhere: Prisma.EquipmentWhereInput = {
    organizationId,
    onPm: true,
    status: "ACTIVE",
  };
  if (facilityId) {
    const hospital = await prisma.hospital.findFirst({
      where: { id: facilityId, organizationId },
      select: { id: true, hospId: true },
    });
    if (!hospital) throw new Error("Hospital not found");
    equipmentWhere = {
      ...equipmentWhere,
      OR: [{ hospitalId: hospital.id }, { hospId: hospital.hospId }],
    };
  }
  const equipment = await prisma.equipment.findMany({
    where: equipmentWhere,
  });
  const templates = await loadMatchTemplates(prisma, organizationId);
  let created = 0;
  for (const eq of equipment) {
    const outcome = await createScheduledPmWorkOrder({
      organizationId,
      userId,
      equipment: eq,
      month,
      dateOpened,
      templates,
    });
    if (outcome.created) created++;
  }
  revalidatePath("/pm-work-orders");
  revalidatePath("/dashboard");
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

    try {
      await ensureStarterPmProcedures(prisma, org.id);
    } catch (seedErr) {
      console.error("[signup] pm procedure starters", seedErr);
    }

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

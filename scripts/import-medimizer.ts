/**
 * Import MediMizer-converted bundle into MEUT via Prisma upserts.
 * Usage:
 *   npx tsx scripts/import-medimizer.ts [--org-slug meut-demo] [--bundle PATH] [--skip-license]
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
function argVal(flag: string, fallback?: string) {
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
}

const orgSlug = argVal("--org-slug", "meut-demo")!;
const skipLicense = args.includes("--skip-license");
const bundlePath =
  argVal("--bundle") ||
  "/workspace/MEUT_migration/converted/medimizer_bundle.json";

type Bundle = {
  facilities: Array<Record<string, string>>;
  equipment: Array<Record<string, string>>;
  vendors: Array<{ vendorId: string; name: string; phone?: string | null; active?: boolean }>;
  manufacturers: Array<{ manfNum: string; name: string; active?: boolean }>;
  employees: Array<{
    techId: string;
    username: string;
    name: string;
    role: string;
    active?: boolean;
  }>;
  work_orders: Array<{
    woNumber: number;
    controlNum: string;
    dateOpened?: string | null;
    type: string;
    workRequested?: string;
    status?: string;
  }>;
  contracts: Array<Record<string, unknown>>;
  source_counts?: Record<string, number>;
  equipment_facility_stats?: Record<string, number>;
  mapping_notes?: Record<string, string>;
};

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Bundle not found: ${bundlePath}`);
  }
  const bundle: Bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

  let org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: orgSlug === "travis-live" ? "Travis Live" : orgSlug,
        slug: orgSlug,
        tier: "CREATOR",
        active: true,
      },
    });
    console.log(`Created org ${org.slug} (${org.id}) tier=CREATOR`);
  } else if (org.tier !== "CREATOR" && skipLicense) {
    org = await prisma.organization.update({
      where: { id: org.id },
      data: { tier: "CREATOR" },
    });
    console.log(`Promoted ${org.slug} → CREATOR (--skip-license)`);
  }

  console.log(`Importing into org ${org.slug} (${org.id}) tier=${org.tier}`);
  console.log("Source counts:", bundle.source_counts);
  console.log("Equipment facility stats:", bundle.equipment_facility_stats);

  const before = {
    hospitals: await prisma.hospital.count({ where: { organizationId: org.id } }),
    departments: await prisma.department.count({ where: { organizationId: org.id } }),
    equipment: await prisma.equipment.count({ where: { organizationId: org.id } }),
    workOrders: await prisma.workOrder.count({ where: { organizationId: org.id } }),
    vendors: await prisma.vendor.count({ where: { organizationId: org.id } }),
    manufacturers: await prisma.manufacturer.count({ where: { organizationId: org.id } }),
    contracts: await prisma.serviceContract.count({ where: { organizationId: org.id } }),
    users: await prisma.user.count({ where: { organizationId: org.id } }),
  };
  console.log("BEFORE:", before);

  const results = {
    hospitalsCreated: 0,
    hospitalsUpdated: 0,
    departmentsCreated: 0,
    departmentsUpdated: 0,
    equipmentCreated: 0,
    equipmentUpdated: 0,
    vendorsCreated: 0,
    vendorsUpdated: 0,
    manufacturersCreated: 0,
    manufacturersUpdated: 0,
    usersCreated: 0,
    usersUpdated: 0,
    usersSkippedProtected: 0,
    workOrdersCreated: 0,
    workOrdersUpdated: 0,
    workOrdersSkippedNoEquip: 0,
    contractsCreated: 0,
    contractsUpdated: 0,
  };

  const hospitalByHospId = new Map<string, { id: string; hospId: string }>();
  const existingHosp = new Set(
    (
      await prisma.hospital.findMany({
        where: { organizationId: org.id },
        select: { hospId: true },
      })
    ).map((h) => h.hospId)
  );

  for (const f of bundle.facilities) {
    const hospId = f.hosp_id;
    const name = f.name;
    if (!hospId || !name) continue;
    const data = {
      name,
      address: f.address || null,
      city: f.city || null,
      state: f.state || null,
      zip: f.zip || null,
      phone: f.phone || null,
      contact: f.contact || null,
      active: String(f.active).toLowerCase() !== "false",
    };
    const hospital = await prisma.hospital.upsert({
      where: { organizationId_hospId: { organizationId: org.id, hospId } },
      create: { organizationId: org.id, hospId, ...data },
      update: data,
    });
    hospitalByHospId.set(hospId, { id: hospital.id, hospId });
    if (existingHosp.has(hospId)) results.hospitalsUpdated++;
    else results.hospitalsCreated++;
  }

  const deptCache = new Map<string, string>(); // `${hospId}|${costCtr}` -> id
  const existingDepts = await prisma.department.findMany({
    where: { organizationId: org.id },
    select: { id: true, hospId: true, costCtr: true },
  });
  for (const d of existingDepts) deptCache.set(`${d.hospId}|${d.costCtr}`, d.id);

  async function ensureDept(
    hospId: string,
    costCtr: string,
    name: string
  ): Promise<string | null> {
    const key = `${hospId}|${costCtr}`;
    const cached = deptCache.get(key);
    if (cached) {
      return cached;
    }
    const hospital = hospitalByHospId.get(hospId);
    if (!hospital) return null;
    const dept = await prisma.department.create({
      data: {
        organizationId: org!.id,
        hospitalId: hospital.id,
        hospId,
        costCtr,
        name,
        active: true,
      },
    });
    deptCache.set(key, dept.id);
    results.departmentsCreated++;
    return dept.id;
  }

  for (const h of Array.from(hospitalByHospId.values())) {
    await ensureDept(h.hospId, "GENERAL", "GENERAL");
  }

  const existingManf = new Set(
    (
      await prisma.manufacturer.findMany({
        where: { organizationId: org.id },
        select: { manfNum: true },
      })
    ).map((m) => m.manfNum)
  );
  for (const m of bundle.manufacturers) {
    if (!m.manfNum || !m.name) continue;
    await prisma.manufacturer.upsert({
      where: {
        organizationId_manfNum: { organizationId: org.id, manfNum: m.manfNum },
      },
      create: {
        organizationId: org.id,
        manfNum: m.manfNum,
        name: m.name,
        active: m.active !== false,
      },
      update: { name: m.name, active: m.active !== false },
    });
    if (existingManf.has(m.manfNum)) results.manufacturersUpdated++;
    else results.manufacturersCreated++;
  }

  const existingVend = new Set(
    (
      await prisma.vendor.findMany({
        where: { organizationId: org.id },
        select: { vendorId: true },
      })
    ).map((v) => v.vendorId)
  );
  for (const v of bundle.vendors) {
    if (!v.vendorId || !v.name) continue;
    await prisma.vendor.upsert({
      where: {
        organizationId_vendorId: { organizationId: org.id, vendorId: v.vendorId },
      },
      create: {
        organizationId: org.id,
        vendorId: v.vendorId,
        name: v.name,
        phone: v.phone || null,
        active: v.active !== false,
      },
      update: {
        name: v.name,
        phone: v.phone || null,
        active: v.active !== false,
      },
    });
    if (existingVend.has(v.vendorId)) results.vendorsUpdated++;
    else results.vendorsCreated++;
  }

  console.log("Importing equipment...");
  const existingEq = new Set(
    (
      await prisma.equipment.findMany({
        where: { organizationId: org.id },
        select: { controlNum: true },
      })
    ).map((e) => e.controlNum)
  );
  const equipmentByControl = new Map<string, string>();
  let eqI = 0;
  for (const e of bundle.equipment) {
    const controlNum = e.control_num;
    if (!controlNum) continue;
    const hospId = e.hosp_id || "UNKNOWN";
    const costCtr = e.cost_ctr || "GENERAL";
    const deptName = e.department || costCtr || "GENERAL";
    const departmentId = await ensureDept(hospId, costCtr, deptName);
    const hospital = hospitalByHospId.get(hospId);
    const data = {
      hospId,
      hospitalId: hospital?.id ?? null,
      departmentId,
      costCtr,
      serial: e.serial || null,
      manufacturer: e.manufacturer || null,
      model: e.model || null,
      description: e.description || null,
      location: e.location || e.department || null,
      status: e.status === "RETIRED" ? "RETIRED" : "ACTIVE",
      onPm: String(e.on_pm).toLowerCase() === "true",
      pmSchedule1: e.pm_schedule1 || null,
    };
    const eq = await prisma.equipment.upsert({
      where: {
        organizationId_controlNum: { organizationId: org.id, controlNum },
      },
      create: { organizationId: org.id, controlNum, ...data },
      update: data,
    });
    equipmentByControl.set(controlNum, eq.id);
    if (existingEq.has(controlNum)) results.equipmentUpdated++;
    else results.equipmentCreated++;
    eqI++;
    if (eqI % 500 === 0) console.log(`  equipment ${eqI}/${bundle.equipment.length}`);
  }

  for (const e of await prisma.equipment.findMany({
    where: { organizationId: org.id },
    select: { id: true, controlNum: true, hospId: true, costCtr: true },
  })) {
    equipmentByControl.set(e.controlNum, e.id);
  }
  // slim lookup for WO hosp/cost
  const eqMeta = new Map<string, { hospId: string | null; costCtr: string | null }>();
  for (const e of await prisma.equipment.findMany({
    where: { organizationId: org.id },
    select: { controlNum: true, hospId: true, costCtr: true },
  })) {
    eqMeta.set(e.controlNum, { hospId: e.hospId, costCtr: e.costCtr });
  }

  const protectedUsernames = new Set(["tw", "supervisor"]);
  const defaultHash = await bcrypt.hash("ChangeMe1!", 10);
  for (const emp of bundle.employees) {
    if (!emp.username || !emp.techId) continue;
    if (protectedUsernames.has(emp.username.toLowerCase())) {
      results.usersSkippedProtected++;
      continue;
    }
    const existingByUser = await prisma.user.findUnique({
      where: { username: emp.username },
    });
    const existingByTech = await prisma.user.findFirst({
      where: { organizationId: org.id, techId: emp.techId },
    });
    const parts = emp.name.trim().split(/\s+/);
    const firstName = parts[0] || null;
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
    if (existingByUser) {
      if (existingByUser.organizationId === org.id) {
        await prisma.user.update({
          where: { id: existingByUser.id },
          data: {
            techId: emp.techId,
            name: emp.name,
            firstName,
            lastName,
            role: emp.role === "SUPERVISOR" ? "SUPERVISOR" : "TECH",
            active: emp.active !== false,
            initials: emp.techId.slice(0, 3).toUpperCase(),
          },
        });
        results.usersUpdated++;
      } else {
        results.usersSkippedProtected++;
      }
      continue;
    }
    if (existingByTech) {
      await prisma.user.update({
        where: { id: existingByTech.id },
        data: {
          name: emp.name,
          firstName,
          lastName,
          role: emp.role === "SUPERVISOR" ? "SUPERVISOR" : "TECH",
          active: emp.active !== false,
        },
      });
      results.usersUpdated++;
      continue;
    }
    await prisma.user.create({
      data: {
        organizationId: org.id,
        techId: emp.techId,
        username: emp.username,
        name: emp.name,
        firstName,
        lastName,
        passwordHash: defaultHash,
        role: emp.role === "SUPERVISOR" ? "SUPERVISOR" : "TECH",
        active: emp.active !== false,
        initials: emp.techId.slice(0, 3).toUpperCase(),
      },
    });
    results.usersCreated++;
  }

  console.log("Importing work orders...");
  const existingWo = new Set(
    (
      await prisma.workOrder.findMany({
        where: { organizationId: org.id },
        select: { woNumber: true },
      })
    ).map((w) => w.woNumber)
  );

  let maxWo = 0;
  let woI = 0;
  // Batch createMany for new WOs where possible; upsert remaining
  const toCreate: Array<{
    organizationId: string;
    woNumber: number;
    type: string;
    status: string;
    equipmentId: string;
    controlNum: string;
    hospId: string | null;
    costCtr: string | null;
    workRequested: string | null;
    dateOpened: Date;
    dateClosed: Date | null;
  }> = [];

  for (const wo of bundle.work_orders) {
    const equipmentId = equipmentByControl.get(wo.controlNum);
    if (!equipmentId) {
      results.workOrdersSkippedNoEquip++;
      continue;
    }
    const meta = eqMeta.get(wo.controlNum);
    const dateOpened = parseDate(wo.dateOpened) || new Date();
    const row = {
      organizationId: org.id,
      woNumber: wo.woNumber,
      type: wo.type === "PM" ? "PM" : "CM",
      status: wo.status || "CLOSED",
      equipmentId,
      controlNum: wo.controlNum,
      hospId: meta?.hospId ?? null,
      costCtr: meta?.costCtr ?? null,
      workRequested: wo.workRequested || null,
      dateOpened,
      dateClosed: wo.status === "OPEN" ? null : dateOpened,
    };
    if (wo.woNumber > maxWo) maxWo = wo.woNumber;

    if (existingWo.has(wo.woNumber)) {
      await prisma.workOrder.update({
        where: {
          organizationId_woNumber: {
            organizationId: org.id,
            woNumber: wo.woNumber,
          },
        },
        data: {
          type: row.type,
          status: row.status,
          equipmentId: row.equipmentId,
          controlNum: row.controlNum,
          hospId: row.hospId,
          costCtr: row.costCtr,
          workRequested: row.workRequested,
          dateOpened: row.dateOpened,
          dateClosed: row.dateClosed,
        },
      });
      results.workOrdersUpdated++;
    } else {
      toCreate.push(row);
    }
    woI++;
    if (woI % 2000 === 0) {
      console.log(`  scanned WOs ${woI}/${bundle.work_orders.length} (queue create ${toCreate.length})`);
    }
  }

  const BATCH = 200;
  for (let i = 0; i < toCreate.length; i += BATCH) {
    const chunk = toCreate.slice(i, i + BATCH);
    try {
      await prisma.workOrder.createMany({ data: chunk, skipDuplicates: true });
      results.workOrdersCreated += chunk.length;
    } catch (e) {
      // fallback one-by-one
      for (const row of chunk) {
        try {
          await prisma.workOrder.create({ data: row });
          results.workOrdersCreated++;
        } catch {
          results.workOrdersSkippedNoEquip++;
        }
      }
    }
    if ((i / BATCH) % 10 === 0) {
      console.log(`  created WOs ${Math.min(i + BATCH, toCreate.length)}/${toCreate.length}`);
    }
  }

  if (maxWo > 0) {
    const counterId = `wo:${org.id}`;
    const cur = await prisma.counter.findUnique({ where: { id: counterId } });
    const nextVal = Math.max(cur?.value ?? 0, maxWo);
    await prisma.counter.upsert({
      where: { id: counterId },
      create: { id: counterId, value: nextVal },
      update: { value: nextVal },
    });
  }

  for (const c of bundle.contracts || []) {
    const contractNum = String((c as any).contractNum || "");
    if (!contractNum) continue;
    const existing = await prisma.serviceContract.findUnique({
      where: {
        organizationId_contractNum: { organizationId: org.id, contractNum },
      },
    });
    const hospId = (c as any).hospId as string | null;
    const hospital = hospId ? hospitalByHospId.get(hospId) : undefined;
    const data = {
      name: ((c as any).name as string) || null,
      vendorId: ((c as any).vendorId as string) || null,
      vendorName: ((c as any).vendorName as string) || null,
      hospitalId: hospital?.id ?? null,
      hospId: hospId || null,
      startDate: parseDate((c as any).startDate as string),
      expirationDate: parseDate((c as any).expirationDate as string),
      coverageSummary: ((c as any).coverageSummary as string) || null,
      notes: ((c as any).notes as string) || null,
      active: true,
    };
    await prisma.serviceContract.upsert({
      where: {
        organizationId_contractNum: { organizationId: org.id, contractNum },
      },
      create: { organizationId: org.id, contractNum, ...data },
      update: data,
    });
    if (existing) results.contractsUpdated++;
    else results.contractsCreated++;
  }

  const after = {
    hospitals: await prisma.hospital.count({ where: { organizationId: org.id } }),
    departments: await prisma.department.count({ where: { organizationId: org.id } }),
    equipment: await prisma.equipment.count({ where: { organizationId: org.id } }),
    workOrders: await prisma.workOrder.count({ where: { organizationId: org.id } }),
    vendors: await prisma.vendor.count({ where: { organizationId: org.id } }),
    manufacturers: await prisma.manufacturer.count({ where: { organizationId: org.id } }),
    contracts: await prisma.serviceContract.count({ where: { organizationId: org.id } }),
    users: await prisma.user.count({ where: { organizationId: org.id } }),
  };

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      lastImportAt: new Date(),
      lastImportSummary: JSON.stringify({
        kind: "medimizer-xlsx",
        results,
        before,
        after,
      }),
    },
  });

  const summary = {
    org: { id: org.id, slug: org.slug, tier: org.tier },
    before,
    after,
    results,
    mapping_notes: bundle.mapping_notes,
  };
  const outPath = "/workspace/MEUT_migration/logs/import_results.json";
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log("RESULTS:", JSON.stringify(results, null, 2));
  console.log("AFTER:", after);
  console.log(`Wrote ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

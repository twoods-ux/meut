/**
 * Remap equipment hospital/department from MediMizer export that includes Facility Code.
 *
 * Usage:
 *   npx tsx scripts/remap-equipment-facilities.ts \
 *     [--org-slug meut-demo] \
 *     [--source PATH] \
 *     [--log PATH]
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
function argVal(flag: string, fallback?: string) {
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
}

const orgSlug = argVal("--org-slug", "meut-demo")!;
const sourcePath =
  argVal("--source") ||
  "/workspace/MEUT_migration/converted/equipment_facility_remap.json";
const logPath =
  argVal("--log") || "/workspace/MEUT_migration/logs/facility_remap.json";

type Row = {
  controlNum: string;
  facilityCode: string;
  facilityDescription: string;
  departmentDescription: string;
};

function slugCostCtr(name: string): string {
  const s = (name || "GENERAL")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (s || "GENERAL").slice(0, 48);
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source not found: ${sourcePath}`);
  }
  const rows: Row[] = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  console.log(`Loaded ${rows.length} remap rows from ${sourcePath}`);

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) throw new Error(`Organization not found: ${orgSlug}`);
  console.log(`Org ${org.slug} (${org.id}) tier=${org.tier}`);

  const beforeUnknown = await prisma.equipment.count({
    where: { organizationId: org.id, hospId: "UNKNOWN" },
  });
  const beforeTotal = await prisma.equipment.count({
    where: { organizationId: org.id },
  });

  const results = {
    sourceRows: rows.length,
    equipmentUpdated: 0,
    equipmentUnchanged: 0,
    missingControlNums: 0,
    hospitalsCreated: 0,
    hospitalsUpdated: 0,
    departmentsCreated: 0,
    rowsSkippedNoFacility: 0,
    missingControlNumList: [] as string[],
  };

  // Prefetch hospitals
  const hospitalByHospId = new Map<string, { id: string; hospId: string; name: string }>();
  for (const h of await prisma.hospital.findMany({
    where: { organizationId: org.id },
    select: { id: true, hospId: true, name: true },
  })) {
    hospitalByHospId.set(h.hospId, h);
  }

  // Prefetch departments: key hospId|costCtr
  const deptCache = new Map<string, string>();
  for (const d of await prisma.department.findMany({
    where: { organizationId: org.id },
    select: { id: true, hospId: true, costCtr: true },
  })) {
    deptCache.set(`${d.hospId}|${d.costCtr}`, d.id);
  }

  // Prefetch equipment by controlNum
  const equipmentByControl = new Map<
    string,
    { id: string; controlNum: string; hospId: string | null; hospitalId: string | null; departmentId: string | null; costCtr: string | null }
  >();
  for (const e of await prisma.equipment.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      controlNum: true,
      hospId: true,
      hospitalId: true,
      departmentId: true,
      costCtr: true,
    },
  })) {
    equipmentByControl.set(e.controlNum, e);
  }

  async function upsertHospital(hospId: string, name: string) {
    const existing = hospitalByHospId.get(hospId);
    if (existing) {
      if (existing.name !== name && name) {
        const updated = await prisma.hospital.update({
          where: { id: existing.id },
          data: { name },
          select: { id: true, hospId: true, name: true },
        });
        hospitalByHospId.set(hospId, updated);
        results.hospitalsUpdated++;
        return updated;
      }
      return existing;
    }
    const created = await prisma.hospital.create({
      data: {
        organizationId: org!.id,
        hospId,
        name: name || hospId,
        active: true,
      },
      select: { id: true, hospId: true, name: true },
    });
    hospitalByHospId.set(hospId, created);
    results.hospitalsCreated++;
    return created;
  }

  async function ensureDept(
    hospital: { id: string; hospId: string },
    costCtr: string,
    name: string
  ): Promise<string> {
    const key = `${hospital.hospId}|${costCtr}`;
    const cached = deptCache.get(key);
    if (cached) return cached;
    try {
      const dept = await prisma.department.create({
        data: {
          organizationId: org!.id,
          hospitalId: hospital.id,
          hospId: hospital.hospId,
          costCtr,
          name,
          active: true,
        },
      });
      deptCache.set(key, dept.id);
      results.departmentsCreated++;
      return dept.id;
    } catch {
      // race / unique — re-read
      const found = await prisma.department.findUnique({
        where: {
          organizationId_hospId_costCtr: {
            organizationId: org!.id,
            hospId: hospital.hospId,
            costCtr,
          },
        },
      });
      if (!found) throw new Error(`Failed to ensure dept ${key}`);
      deptCache.set(key, found.id);
      return found.id;
    }
  }

  let i = 0;
  for (const row of rows) {
    i++;
    const controlNum = (row.controlNum || "").trim();
    const facilityCode = (row.facilityCode || "").trim();
    const facilityDescription = (row.facilityDescription || "").trim();
    const departmentDescription = (row.departmentDescription || "").trim();

    if (!controlNum) continue;
    if (!facilityCode) {
      results.rowsSkippedNoFacility++;
      continue;
    }

    const eq = equipmentByControl.get(controlNum);
    if (!eq) {
      results.missingControlNums++;
      if (results.missingControlNumList.length < 50) {
        results.missingControlNumList.push(controlNum);
      }
      continue;
    }

    const hospital = await upsertHospital(facilityCode, facilityDescription);
    await ensureDept(hospital, "GENERAL", "GENERAL");

    const costCtr = departmentDescription
      ? slugCostCtr(departmentDescription)
      : "GENERAL";
    const deptName = departmentDescription || "GENERAL";
    const departmentId = await ensureDept(hospital, costCtr, deptName);

    const same =
      eq.hospId === hospital.hospId &&
      eq.hospitalId === hospital.id &&
      eq.departmentId === departmentId &&
      eq.costCtr === costCtr;

    if (same) {
      results.equipmentUnchanged++;
    } else {
      await prisma.equipment.update({
        where: { id: eq.id },
        data: {
          hospId: hospital.hospId,
          hospitalId: hospital.id,
          departmentId,
          costCtr,
          // Keep location in sync with department when we have a description
          ...(departmentDescription ? { location: departmentDescription } : {}),
        },
      });
      results.equipmentUpdated++;
      // refresh cache
      equipmentByControl.set(controlNum, {
        ...eq,
        hospId: hospital.hospId,
        hospitalId: hospital.id,
        departmentId,
        costCtr,
      });
    }

    if (i % 500 === 0) {
      console.log(`  processed ${i}/${rows.length} (updated ${results.equipmentUpdated})`);
    }
  }

  const afterUnknown = await prisma.equipment.count({
    where: { organizationId: org.id, hospId: "UNKNOWN" },
  });
  const afterNullHosp = await prisma.equipment.count({
    where: { organizationId: org.id, OR: [{ hospId: null }, { hospitalId: null }] },
  });
  const afterTotal = await prisma.equipment.count({
    where: { organizationId: org.id },
  });

  // hospId distribution (top)
  const byHosp = await prisma.equipment.groupBy({
    by: ["hospId"],
    where: { organizationId: org.id },
    _count: { _all: true },
    orderBy: { _count: { hospId: "desc" } },
    take: 20,
  });

  const summary = {
    ranAt: new Date().toISOString(),
    org: { id: org.id, slug: org.slug, tier: org.tier },
    sourcePath,
    before: { total: beforeTotal, unknownHospId: beforeUnknown },
    after: {
      total: afterTotal,
      unknownHospId: afterUnknown,
      nullHospOrHospitalId: afterNullHosp,
    },
    results: {
      ...results,
      // keep list but note truncation
      missingControlNumListTruncated: results.missingControlNums > results.missingControlNumList.length,
    },
    topHospIds: byHosp.map((g) => ({ hospId: g.hospId, count: g._count._all })),
  };

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify(summary, null, 2));

  console.log("RESULTS:", JSON.stringify(results, null, 2));
  console.log(`BEFORE unknown hospId: ${beforeUnknown} / ${beforeTotal}`);
  console.log(`AFTER  unknown hospId: ${afterUnknown} / ${afterTotal}`);
  console.log(`AFTER  null hospId/hospitalId: ${afterNullHosp}`);
  console.log(`Wrote ${logPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

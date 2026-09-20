/**
 * Shared HarvestCEMS .mdb → Postgres (Prisma) import.
 * Used by CLI (`npm run import:mdb`) and POST /api/import/mdb.
 */
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";
import {
  getFacilityLimit,
  LICENSE_TIERS,
  LICENSE_UPGRADE_MESSAGE,
  type LicenseTier,
  isLicenseTier,
} from "./license";

export type ImportMdbCounts = {
  hospitals: number;
  departments: number;
  technicians: number;
  equipment: number;
  contracts: number;
  manufacturers: number;
  vendors: number;
  workOrders: number;
};

export type ImportMdbResult = {
  ok: true;
  mdbPath: string;
  counts: ImportMdbCounts;
  warnings: string[];
};

export type ImportMdbOptions = {
  /** Target tenant — required for API; CLI defaults to MEUT Demo. */
  organizationId: string;
  /** Cap rows per table (CLI --limit). 0 = no limit. */
  limit?: number;
  /** Skip facility-tier check (admin CLI only). Default false. */
  skipLicenseCheck?: boolean;
  /** Prisma client override (tests). */
  prisma?: PrismaClient;
  /** Log progress (CLI). */
  log?: (msg: string) => void;
};

export class ImportMdbError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    status = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ImportMdbError";
    this.status = status;
    this.details = details;
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      if (row.some((x) => x.length)) rows.push(row);
      row = [];
      cur = "";
    } else if (c !== "\r") cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function mdbExport(mdbPath: string, table: string): string[][] {
  if (!existsSync(mdbPath)) {
    throw new ImportMdbError(`MDB not found: ${mdbPath}`, 400);
  }
  try {
    const csv = execFileSync("mdb-export", [mdbPath, table], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return parseCsv(csv);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ImportMdbError(
      `mdb-export failed for table "${table}". Is mdbtools installed? ${msg}`,
      500
    );
  }
}

function rowsAsObjects(
  mdbPath: string,
  table: string,
  limit = 0
): Record<string, string>[] {
  const rows = mdbExport(mdbPath, table);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  let data = rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => {
      o[h] = (r[i] ?? "").trim();
    });
    return o;
  });
  if (limit > 0) data = data.slice(0, limit);
  return data;
}

function parseBool(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "-1";
}

function parseDate(v: string | undefined): Date | null {
  if (!v || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseFloatSafe(v: string | undefined): number | null {
  if (!v || !v.trim()) return null;
  const n = Number(v.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function mapEquipStatus(raw: string | undefined): string {
  const s = (raw || "").toUpperCase();
  if (s === "R" || s === "RET" || s.includes("RETIR")) return "RETIRED";
  return "ACTIVE";
}

function mapWoType(raw: string | undefined): string {
  const s = (raw || "").toUpperCase();
  if (s.startsWith("P")) return "PM";
  return "CM";
}

function mapWoStatus(raw: string | undefined, dateClosed?: string): string {
  if (dateClosed && dateClosed.trim()) return "CLOSED";
  const n = Number(raw);
  if (Number.isFinite(n)) {
    if (n === 0) return "OPEN";
    if (n === 9) return "CANCELLED";
    return "CLOSED";
  }
  const s = (raw || "").toUpperCase();
  if (s.includes("CANCEL")) return "CANCELLED";
  if (s.includes("CLOSE") || s === "C") return "CLOSED";
  return "OPEN";
}

/** Count hospitals in MDB without writing to the DB. */
export function countHospitalsInMdb(mdbPath: string, limit = 0): number {
  const hospitals = rowsAsObjects(mdbPath, "tblHospitals", limit);
  return hospitals.filter((h) => h.HospID).length;
}

async function assertLicenseAllowsHospitalCount(
  prisma: PrismaClient,
  organizationId: string,
  hospitalCountInFile: number
): Promise<{ tier: LicenseTier; limit: number | null }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org || !org.active) {
    throw new ImportMdbError("Organization not found or inactive", 403);
  }
  const tierRaw = org.tier ?? "STARTER";
  const tier: LicenseTier = isLicenseTier(tierRaw) ? tierRaw : "STARTER";
  const limit = getFacilityLimit(tier);
  if (limit !== null && hospitalCountInFile > limit) {
    const def = LICENSE_TIERS[tier];
    throw new ImportMdbError(
      `This Access file has ${hospitalCountInFile} hospitals, but your ${def.name} plan allows only ${limit}. ${LICENSE_UPGRADE_MESSAGE} Upgrade before importing, or reduce hospitals in the source file.`,
      403,
      {
        hospitalsInFile: hospitalCountInFile,
        tier,
        facilityCap: limit,
        upgradeMessage: LICENSE_UPGRADE_MESSAGE,
      }
    );
  }
  return { tier, limit };
}

/**
 * Import (upsert) data from a HarvestCEMSdata.mdb file.
 * Fails before mutating if hospital count exceeds the current license tier.
 */
export async function importMdb(
  mdbPath: string,
  options: ImportMdbOptions
): Promise<ImportMdbResult> {
  const prisma = options.prisma ?? defaultPrisma;
  const organizationId = options.organizationId;
  if (!organizationId) {
    throw new ImportMdbError("organizationId is required for import", 400);
  }
  const limit = options.limit ?? 0;
  const log = options.log ?? (() => {});
  const warnings: string[] = [];

  if (!existsSync(mdbPath)) {
    throw new ImportMdbError(`MDB not found: ${mdbPath}`, 400);
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) {
    throw new ImportMdbError("Organization not found", 404);
  }

  log(`Importing from ${mdbPath} → org ${org.slug} (${org.name})`);

  const hospitalsPreview = rowsAsObjects(mdbPath, "tblHospitals", limit);
  const hospitalCount = hospitalsPreview.filter((h) => h.HospID).length;

  if (!options.skipLicenseCheck) {
    const { tier, limit: cap } = await assertLicenseAllowsHospitalCount(
      prisma,
      organizationId,
      hospitalCount
    );
    log(
      `License check OK (${tier}${cap !== null ? `, cap ${cap}` : ", unlimited"}): ${hospitalCount} hospitals in file`
    );
  }

  const defaultHash = await bcrypt.hash("password", 10);

  const hospitals = hospitalsPreview;
  log(`Hospitals: ${hospitals.length}`);
  const hospMap = new Map<string, string>();
  for (const h of hospitals) {
    const hospId = h.HospID;
    if (!hospId) continue;
    const rec = await prisma.hospital.upsert({
      where: { organizationId_hospId: { organizationId, hospId } },
      create: {
        organizationId,
        hospId,
        name: h.HospName || hospId,
        address: h.Address1 || null,
        city: h.City || null,
        state: h.State || null,
        zip: h.Zip || null,
        phone: h.Phone || null,
        contact: h.HospContact || null,
        beds: h.Beds ? Number(h.Beds) || null : null,
        active: h.Active === "" ? true : parseBool(h.Active),
        comments: h.Comments || null,
      },
      update: {
        name: h.HospName || hospId,
        address: h.Address1 || null,
        city: h.City || null,
        state: h.State || null,
        zip: h.Zip || null,
        phone: h.Phone || null,
      },
    });
    hospMap.set(hospId, rec.id);
  }

  const depts = rowsAsObjects(mdbPath, "tblDepartments", limit);
  log(`Departments: ${depts.length}`);
  const deptMap = new Map<string, string>();
  for (const d of depts) {
    const hospId = d.HospID;
    const costCtr = d.CostCtr;
    if (!hospId || !costCtr) continue;
    const hospitalId = hospMap.get(hospId);
    if (!hospitalId) continue;
    const rec = await prisma.department.upsert({
      where: {
        organizationId_hospId_costCtr: { organizationId, hospId, costCtr },
      },
      create: {
        organizationId,
        hospitalId,
        hospId,
        costCtr,
        name: d.Department || costCtr,
        manager: d.DeptManager || null,
        phone: d.DeptPhone || null,
        fax: d.DeptFax || null,
        email: d.DeptEmail || null,
        defaultPmMonth: d.DeptDefaultPMmonth || null,
        defaultTech: d.DeptDefaultTech || null,
        active: d.Active === "" ? true : parseBool(d.Active),
      },
      update: {
        name: d.Department || costCtr,
        manager: d.DeptManager || null,
        phone: d.DeptPhone || null,
      },
    });
    deptMap.set(`${hospId}|${costCtr}`, rec.id);
  }

  const techs = rowsAsObjects(mdbPath, "tblTechnicians", limit);
  log(`Technicians: ${techs.length}`);
  const techMap = new Map<string, string>();
  for (const t of techs) {
    const techId = t.TechID;
    if (!techId) continue;
    const first = t.FirstName || "";
    const last = t.LastName || "";
    const name = `${first} ${last}`.trim() || techId;
    let username =
      (t.TechInitials || techId).toLowerCase().replace(/\W/g, "") ||
      techId.toLowerCase();
    const isSup = parseBool(t.IsSupervisor) || Number(t.SecurityLevel) >= 8;
    const plain =
      t.Password && t.Password.length >= 1 && t.Password.length <= 20
        ? t.Password
        : "password";
    const passwordHash = await bcrypt.hash(plain, 10);
    const byTech = await prisma.user.findFirst({
      where: { organizationId, techId },
    });
    const byUser = await prisma.user.findUnique({ where: { username } });
    let rec;
    if (byTech) {
      rec = await prisma.user.update({
        where: { id: byTech.id },
        data: {
          name,
          firstName: first || null,
          lastName: last || null,
          initials: t.TechInitials || null,
          securityLevel: t.SecurityLevel ? Number(t.SecurityLevel) : null,
          role: isSup ? "SUPERVISOR" : "TECH",
          active: t.Active === "" ? true : parseBool(t.Active),
          phone: t.WorkPhone || t.HomePhone || null,
          email: t.HomeEmail || null,
          jobTitle: t.JobTitle || null,
          passwordHash,
        },
      });
    } else {
      if (byUser) username = `${username}_${techId}`.toLowerCase();
      rec = await prisma.user.create({
        data: {
          organizationId,
          techId,
          username,
          name,
          firstName: first || null,
          lastName: last || null,
          passwordHash,
          initials: t.TechInitials || null,
          securityLevel: t.SecurityLevel ? Number(t.SecurityLevel) : null,
          role: isSup ? "SUPERVISOR" : "TECH",
          active: t.Active === "" ? true : parseBool(t.Active),
          phone: t.WorkPhone || t.HomePhone || null,
          email: t.HomeEmail || null,
          jobTitle: t.JobTitle || null,
        },
      });
    }
    techMap.set(techId, rec.id);
    log(`  tech ${techId} -> ${rec.username}`);
  }

  for (const u of [
    {
      username: "supervisor",
      name: "Supervisor",
      role: "SUPERVISOR",
      techId: "SUP",
    },
    { username: "tech", name: "Demo Tech", role: "TECH", techId: "DEM" },
  ]) {
    const existingDemo = await prisma.user.findUnique({
      where: { username: u.username },
    });
    if (existingDemo && existingDemo.organizationId !== organizationId) {
      // Leave other-tenant usernames alone
      continue;
    }
    await prisma.user.upsert({
      where: { username: u.username },
      create: { ...u, organizationId, passwordHash: defaultHash },
      update: { passwordHash: defaultHash, active: true, organizationId },
    });
  }

  const equipment = rowsAsObjects(mdbPath, "tblEQUIPMENT", limit);
  log(`Equipment: ${equipment.length}`);
  let eqOk = 0;
  for (const e of equipment) {
    const controlNum = e.ControlNum;
    if (!controlNum) continue;
    const hospId = e.HospID || null;
    const costCtr = e.CostCtr || null;
    const hospitalId = hospId ? hospMap.get(hospId) : undefined;
    const departmentId =
      hospId && costCtr ? deptMap.get(`${hospId}|${costCtr}`) : undefined;
    await prisma.equipment.upsert({
      where: { organizationId_controlNum: { organizationId, controlNum } },
      create: {
        organizationId,
        controlNum,
        hospId,
        costCtr,
        serial: e.Serial || null,
        manufacturer: e.AltManufacturer || null,
        manfNum: e.ManfNum || null,
        model: e.AltModel || e.ManfModel || null,
        description: e.AltDescription || null,
        deviceNum: e.DeviceNum || null,
        building: e.Building || null,
        location: e.Location || null,
        hospitalId: hospitalId || null,
        departmentId: departmentId || null,
        status: mapEquipStatus(e.EquipStatus),
        equipOwner: e.EquipOwner || null,
        onPm: parseBool(e.EquipOnPM),
        pmProc1: e.PmProc1 || null,
        pmSchedule1: e.PmSchedule1 || null,
        techAssigned1: e.TechAssigned1 || null,
        purchaseDate: parseDate(e.PurchDate),
        purchaseCost: parseFloatSafe(e.PurchCost),
        warrantyPartsEnd: parseDate(e.WarrantyPartsEndDate),
        warrantyLaborEnd: parseDate(e.WarrantyLaborEndDate),
        serviceContractNum: e.ServiceContractNum || null,
        serviceProvider: e.ServiceProvider || null,
        comments: e.EquipComments || null,
        dateRetired: parseDate(e.DateRetired),
      },
      update: {
        serial: e.Serial || null,
        manufacturer: e.AltManufacturer || null,
        model: e.AltModel || e.ManfModel || null,
        description: e.AltDescription || null,
        location: e.Location || null,
        hospitalId: hospitalId || null,
        departmentId: departmentId || null,
        status: mapEquipStatus(e.EquipStatus),
        onPm: parseBool(e.EquipOnPM),
        pmSchedule1: e.PmSchedule1 || null,
      },
    });
    eqOk++;
  }
  log(`  upserted ${eqOk}`);

  const contracts = rowsAsObjects(mdbPath, "tblServiceContracts", limit);
  log(`Contracts: ${contracts.length}`);
  let contractOk = 0;
  for (const c of contracts) {
    const contractNum = c.ServiceContractNum;
    if (!contractNum) continue;
    const hospId = c.HospID || null;
    await prisma.serviceContract.upsert({
      where: { organizationId_contractNum: { organizationId, contractNum } },
      create: {
        organizationId,
        contractNum,
        name: c.ServiceContractName || null,
        vendorId: c.VendorID || null,
        hospitalId: hospId ? hospMap.get(hospId) || null : null,
        hospId,
        customerName: c.CustomerName || null,
        startDate: parseDate(c.StartDate),
        expirationDate: parseDate(c.EndDate),
        contractCost: parseFloatSafe(c.ContractCost),
        coverageSummary: c.EquipmentCoveredSummary || null,
        notes: c.ContractNotes || null,
        active: c.Active === "" ? true : parseBool(c.Active),
      },
      update: {
        name: c.ServiceContractName || null,
        expirationDate: parseDate(c.EndDate),
        active: c.Active === "" ? true : parseBool(c.Active),
      },
    });
    contractOk++;
  }

  const manfs = rowsAsObjects(mdbPath, "tblManufacturers", limit);
  log(`Manufacturers: ${manfs.length}`);
  let manfOk = 0;
  for (const m of manfs) {
    const manfNum = m.ManfNum;
    if (!manfNum) continue;
    const name = m.Manufacturer || m.ManfName || manfNum;
    await prisma.manufacturer.upsert({
      where: { organizationId_manfNum: { organizationId, manfNum } },
      create: { organizationId, manfNum, name, active: true },
      update: { name },
    });
    manfOk++;
  }

  const vendors = rowsAsObjects(mdbPath, "tblVendors", limit);
  log(`Vendors: ${vendors.length}`);
  let vendorOk = 0;
  for (const v of vendors) {
    const vendorId = v.VendorID;
    if (!vendorId) continue;
    await prisma.vendor.upsert({
      where: { organizationId_vendorId: { organizationId, vendorId } },
      create: {
        organizationId,
        vendorId,
        name: v.VendorName || vendorId,
        phone: v.Phone || null,
        active: v.Active === "" ? true : parseBool(v.Active),
      },
      update: { name: v.VendorName || vendorId },
    });
    vendorOk++;
  }

  const wos = rowsAsObjects(mdbPath, "tblWorkPerformed", limit);
  log(`Work orders: ${wos.length}`);
  let woOk = 0;
  let maxWo = 0;
  for (const w of wos) {
    const woNumber = Number(w.WO);
    if (!Number.isFinite(woNumber) || woNumber <= 0) continue;
    maxWo = Math.max(maxWo, woNumber);
    const controlNum = w.ControlNum;
    if (!controlNum) continue;
    const eq = await prisma.equipment.findUnique({
      where: { organizationId_controlNum: { organizationId, controlNum } },
    });
    if (!eq) continue;
    const assignedCode = w.TechAssigned1 || null;
    const assignedTechId = assignedCode ? techMap.get(assignedCode) : undefined;
    await prisma.workOrder.upsert({
      where: { organizationId_woNumber: { organizationId, woNumber } },
      create: {
        organizationId,
        woNumber,
        type: mapWoType(w.WoType),
        status: mapWoStatus(w.WoStatus, w.DateClosed),
        equipmentId: eq.id,
        controlNum,
        hospId: w.ControlNumHospID || eq.hospId,
        costCtr: w.CostCtr || eq.costCtr,
        workRequested: w.WRtext || null,
        workPerformed: w.WPtext || null,
        priority: w.WoPriority || null,
        pmMonth: w.PMmonth || null,
        pmYear: w.PMyear ? Number(w.PMyear) || null : null,
        pmProc1: w.PmProc1 || null,
        pmSchedule1: w.PmSchedule1 || null,
        dateOpened: parseDate(w.DateOpened) || new Date(),
        dateClosed: parseDate(w.DateClosed),
        assignedTechId: assignedTechId || null,
        assignedTechCode: assignedCode,
      },
      update: {
        status: mapWoStatus(w.WoStatus, w.DateClosed),
        workRequested: w.WRtext || null,
        workPerformed: w.WPtext || null,
        dateClosed: parseDate(w.DateClosed),
      },
    });
    woOk++;
  }
  log(`  upserted ${woOk}`);

  const counterId = `wo:${organizationId}`;
  await prisma.counter.upsert({
    where: { id: counterId },
    create: { id: counterId, value: maxWo },
    update: { value: maxWo },
  });

  const counts: ImportMdbCounts = {
    hospitals: hospMap.size,
    departments: deptMap.size,
    technicians: techMap.size,
    equipment: eqOk,
    contracts: contractOk,
    manufacturers: manfOk,
    vendors: vendorOk,
    workOrders: woOk,
  };

  // Persist last-import summary on Organization
  const summaryJson = JSON.stringify(counts);
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      lastImportAt: new Date(),
      lastImportSummary: summaryJson,
    },
  });

  warnings.push(
    "Import upserts from the Access file; HarvestCEMS remains source of truth until cutover."
  );

  log("Import complete.");
  return { ok: true, mdbPath, counts, warnings };
}

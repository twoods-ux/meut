import { prisma } from "./prisma";
import { assertCanAddFacility } from "./license-server";

export type CsvImportKind = "facilities" | "equipment";

export type CsvImportCounts = {
  facilities: number;
  equipment: number;
  skipped: number;
};

export class ImportCsvError extends Error {
  status: number;
  details?: string;
  constructor(message: string, status = 400, details?: string) {
    super(message);
    this.name = "ImportCsvError";
    this.status = status;
    this.details = details;
  }
}

/** Minimal CSV parser: handles quotes, commas, CRLF. First row = headers. */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.some((c) => c !== "")) rows.push(row);
  }

  if (rows.length < 2) {
    throw new ImportCsvError("CSV needs a header row and at least one data row");
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const data = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });

  return { headers, rows: data };
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v) return v;
  }
  return "";
}

export async function importFacilitiesCsv(
  text: string,
  organizationId: string
): Promise<{ counts: CsvImportCounts; warnings: string[] }> {
  const { rows } = parseCsv(text);
  const warnings: string[] = [];
  let facilities = 0;
  let skipped = 0;

  for (const row of rows) {
    const hospId = pick(row, "hosp_id", "facility_id", "id", "code");
    const name = pick(row, "name", "facility_name", "hospital_name");
    if (!hospId || !name) {
      skipped++;
      warnings.push(`Skipped row missing hosp_id/name: ${JSON.stringify(row)}`);
      continue;
    }

    const existing = await prisma.hospital.findUnique({
      where: { organizationId_hospId: { organizationId, hospId } },
    });
    if (!existing) {
      try {
        await assertCanAddFacility(organizationId);
      } catch (e) {
        warnings.push(
          `Stopped at facility ${hospId}: ${e instanceof Error ? e.message : "facility cap"}`
        );
        break;
      }
    }

    await prisma.hospital.upsert({
      where: { organizationId_hospId: { organizationId, hospId } },
      create: {
        organizationId,
        hospId,
        name,
        address: pick(row, "address", "address1") || null,
        city: pick(row, "city") || null,
        state: pick(row, "state") || null,
        zip: pick(row, "zip", "postal_code") || null,
        phone: pick(row, "phone") || null,
        contact: pick(row, "contact") || null,
        active: pick(row, "active", "status").toLowerCase() !== "inactive",
      },
      update: {
        name,
        address: pick(row, "address", "address1") || null,
        city: pick(row, "city") || null,
        state: pick(row, "state") || null,
        zip: pick(row, "zip", "postal_code") || null,
        phone: pick(row, "phone") || null,
        contact: pick(row, "contact") || null,
      },
    });
    facilities++;
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      lastImportAt: new Date(),
      lastImportSummary: JSON.stringify({
        facilities,
        equipment: 0,
        skipped,
        kind: "csv-facilities",
      }),
    },
  });

  return { counts: { facilities, equipment: 0, skipped }, warnings };
}

export async function importEquipmentCsv(
  text: string,
  organizationId: string
): Promise<{ counts: CsvImportCounts; warnings: string[] }> {
  const { rows } = parseCsv(text);
  const warnings: string[] = [];
  let equipment = 0;
  let skipped = 0;
  let facilities = 0;

  for (const row of rows) {
    const controlNum = pick(
      row,
      "control_num",
      "control_number",
      "asset_id",
      "equipment_id",
      "id"
    );
    if (!controlNum) {
      skipped++;
      warnings.push(`Skipped row missing control_num: ${JSON.stringify(row)}`);
      continue;
    }

    const hospId = pick(row, "hosp_id", "facility_id", "facility") || null;
    let hospitalId: string | null = null;
    if (hospId) {
      let hospital = await prisma.hospital.findUnique({
        where: { organizationId_hospId: { organizationId, hospId } },
      });
      if (!hospital) {
        const fname =
          pick(row, "facility_name", "hospital_name") || `Facility ${hospId}`;
        try {
          await assertCanAddFacility(organizationId);
          hospital = await prisma.hospital.create({
            data: {
              organizationId,
              hospId,
              name: fname,
              active: true,
            },
          });
          facilities++;
        } catch {
          warnings.push(
            `Equipment ${controlNum}: facility ${hospId} missing and at facility cap`
          );
        }
      }
      hospitalId = hospital?.id ?? null;
    }

    const statusRaw = pick(row, "status").toUpperCase();
    const status =
      statusRaw === "RETIRED" || statusRaw === "INACTIVE" ? "RETIRED" : "ACTIVE";

    await prisma.equipment.upsert({
      where: {
        organizationId_controlNum: { organizationId, controlNum },
      },
      create: {
        organizationId,
        controlNum,
        hospId,
        hospitalId,
        serial: pick(row, "serial", "serial_number") || null,
        manufacturer: pick(row, "manufacturer", "make") || null,
        model: pick(row, "model") || null,
        description: pick(row, "description", "name") || null,
        location: pick(row, "location") || null,
        building: pick(row, "building") || null,
        costCtr: pick(row, "cost_ctr", "cost_center", "department") || null,
        status,
        onPm: ["1", "true", "yes", "y"].includes(
          pick(row, "on_pm", "pm").toLowerCase()
        ),
      },
      update: {
        hospId,
        hospitalId,
        serial: pick(row, "serial", "serial_number") || null,
        manufacturer: pick(row, "manufacturer", "make") || null,
        model: pick(row, "model") || null,
        description: pick(row, "description", "name") || null,
        location: pick(row, "location") || null,
        building: pick(row, "building") || null,
        costCtr: pick(row, "cost_ctr", "cost_center", "department") || null,
        status,
      },
    });
    equipment++;
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      lastImportAt: new Date(),
      lastImportSummary: JSON.stringify({
        facilities,
        equipment,
        skipped,
        kind: "csv-equipment",
      }),
    },
  });

  return { counts: { facilities, equipment, skipped }, warnings };
}

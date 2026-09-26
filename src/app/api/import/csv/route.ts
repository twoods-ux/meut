import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { ensureOrganizationBillable } from "@/lib/billing-gate";
import {
  importEquipmentCsv,
  importFacilitiesCsv,
  ImportCsvError,
  type CsvImportKind,
} from "@/lib/import-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "SUPERVISOR") {
    return NextResponse.json(
      { error: "Supervisor access required" },
      { status: 403 }
    );
  }
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return NextResponse.json(
      { error: "No organization on session" },
      { status: 403 }
    );
  }
  const billing = await ensureOrganizationBillable(organizationId);
  if (!billing.ok) {
    return NextResponse.json({ error: billing.error }, { status: billing.status });
  }

  try {
    const form = await req.formData();
    const kind = String(form.get("kind") || "") as CsvImportKind;
    if (kind !== "facilities" && kind !== "equipment") {
      return NextResponse.json(
        { error: "kind must be facilities or equipment" },
        { status: 400 }
      );
    }
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing CSV file" }, { status: 400 });
    }
    const name = (file.name || "").toLowerCase();
    if (!name.endsWith(".csv")) {
      return NextResponse.json({ error: "File must be .csv" }, { status: 400 });
    }
    const text = await file.text();
    const result =
      kind === "facilities"
        ? await importFacilitiesCsv(text, organizationId)
        : await importEquipmentCsv(text, organizationId);

    return NextResponse.json({
      ok: true,
      kind,
      counts: result.counts,
      warnings: result.warnings.slice(0, 50),
      importedAt: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof ImportCsvError) {
      return NextResponse.json(
        { error: e.message, details: e.details ?? null },
        { status: e.status }
      );
    }
    console.error("[import/csv]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}

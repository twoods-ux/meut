import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { ensureOrganizationBillable } from "@/lib/billing-gate";
import { importMdb, ImportMdbError } from "@/lib/import-mdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Large Access files + mdb-export can take a while */
export const maxDuration = 300;

const IMPORT_DIR = path.join(process.cwd(), "prisma", "imports");

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
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file field (multipart .mdb upload)" },
        { status: 400 }
      );
    }
    const name = file.name || "upload.mdb";
    if (!name.toLowerCase().endsWith(".mdb")) {
      return NextResponse.json(
        { error: "File must be a .mdb Access database" },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    await mkdir(IMPORT_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const savedPath = path.join(IMPORT_DIR, `HarvestCEMSdata-${stamp}.mdb`);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(savedPath, buf);

    const result = await importMdb(savedPath, {
      organizationId,
      log: (msg) => console.log(`[import/mdb] ${msg}`),
    });

    return NextResponse.json({
      ok: true,
      counts: result.counts,
      warnings: result.warnings,
      importedAt: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof ImportMdbError) {
      return NextResponse.json(
        { error: e.message, details: e.details ?? null },
        { status: e.status }
      );
    }
    console.error("[import/mdb]", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Import failed",
      },
      { status: 500 }
    );
  }
}

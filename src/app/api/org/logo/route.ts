import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const MAX_BYTES = 500_000; // ~500KB raw file
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** GET — serve current org logo (auth required). Falls back 404 → clients use MEUT logo. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const orgId = session?.user?.organizationId;
  if (!orgId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { logoDataUrl: true },
  });
  if (!org?.logoDataUrl?.startsWith("data:image/")) {
    return new NextResponse("No logo", { status: 404 });
  }
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(org.logoDataUrl);
  if (!match) {
    return new NextResponse("Invalid logo", { status: 500 });
  }
  const mime = match[1];
  const buf = Buffer.from(match[2], "base64");
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=300",
    },
  });
}

/** POST — supervisor uploads logo (multipart file field "logo"). */
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaffSession();
    if (staff.role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Supervisors only" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("logo");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing logo file" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: "Use PNG, JPEG, WebP, or GIF" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Logo must be 500KB or smaller" },
        { status: 400 }
      );
    }
    const ab = await file.arrayBuffer();
    const b64 = Buffer.from(ab).toString("base64");
    const dataUrl = `data:${file.type};base64,${b64}`;

    await prisma.organization.update({
      where: { id: staff.organizationId },
      data: { logoDataUrl: dataUrl, logoUpdatedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    const status = msg === "Unauthorized" || msg.includes("Customers") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

/** DELETE — remove custom logo (back to MEUT default on prints). */
export async function DELETE() {
  try {
    const staff = await requireStaffSession();
    if (staff.role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Supervisors only" }, { status: 403 });
    }
    await prisma.organization.update({
      where: { id: staff.organizationId },
      data: { logoDataUrl: null, logoUpdatedAt: null },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

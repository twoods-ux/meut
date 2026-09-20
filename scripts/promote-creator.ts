/**
 * One-time: set MEUT Demo (or named org) to CREATOR unlimited + ensure tw supervisor exists.
 * Usage: npx tsx scripts/promote-creator.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const org =
    (await prisma.organization.findFirst({ where: { slug: "meut-demo" } })) ??
    (await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } }));

  if (!org) {
    throw new Error("No organization found to promote");
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: { tier: "CREATOR" },
  });
  console.log(`Promoted org ${org.name} (${org.slug}) → CREATOR`);

  const plain = process.env.MEUT_CREATOR_PASSWORD || 'Meut-6lk8pW698NYp!';
  const hash = await bcrypt.hash(plain, 10);
  console.log("Using creator password from MEUT_CREATOR_PASSWORD or built-in strong default");
  const existing = await prisma.user.findUnique({ where: { username: "tw" } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        organizationId: org.id,
        role: "SUPERVISOR",
        active: true,
        securityLevel: 9,
        jobTitle: "Creator",
        passwordHash: hash,
      },
    });
    console.log("Updated existing user tw → SUPERVISOR on creator org");
  } else {
    await prisma.user.create({
      data: {
        organizationId: org.id,
        techId: "TW",
        username: "tw",
        name: "Travis Woods",
        firstName: "Travis",
        lastName: "Woods",
        passwordHash: hash,
        role: "SUPERVISOR",
        initials: "TW",
        securityLevel: 9,
        jobTitle: "Creator",
      },
    });
    console.log("Created user tw / password (SUPERVISOR) on creator org");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

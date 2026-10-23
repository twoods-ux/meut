/**
 * Idempotent PM procedure starter seed.
 * Inserts missing starters per organization. Does not delete equipment,
 * work orders, or procedures staff have edited. Safe to run on production.
 */
import { PrismaClient } from "@prisma/client";
import { ensureStarterPmProceduresForAll } from "../src/lib/pm-procedure-store";

const prisma = new PrismaClient();

ensureStarterPmProceduresForAll(prisma)
  .then((summary) => {
    console.log(
      `[pm-procedures] orgs=${summary.organizations} created=${summary.created} refreshed=${summary.refreshed} skipped=${summary.skipped}`
    );
  })
  .catch((error) => {
    console.error("[pm-procedures] seed failed", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

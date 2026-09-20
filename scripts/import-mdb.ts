/**
 * CLI wrapper for shared MDB import.
 * Usage: npm run import:mdb -- --mdb /path/to/HarvestCEMSdata.mdb [--org-slug meut-demo] [--limit N] [--skip-license]
 */
import path from "path";
import { importMdb, ImportMdbError } from "../src/lib/import-mdb";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
function argVal(flag: string, fallback?: string) {
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
}

const MDB =
  argVal("--mdb") ||
  path.resolve(__dirname, "../../data/HarvestCEMSdata.mdb");
const LIMIT = Number(argVal("--limit", "0")) || 0;
const skipLicense = args.includes("--skip-license");
const orgSlug = argVal("--org-slug", "meut-demo")!;

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    throw new Error(
      `Organization slug "${orgSlug}" not found. Seed first or pass --org-slug.`
    );
  }
  const result = await importMdb(MDB, {
    organizationId: org.id,
    limit: LIMIT,
    skipLicenseCheck: skipLicense,
    log: (msg) => console.log(msg),
  });
  console.log("Counts:", result.counts);
  console.log(`Imported into org ${org.slug}. Login: supervisor / password`);
}

main()
  .catch((e) => {
    if (e instanceof ImportMdbError) {
      console.error(e.message);
      if (e.details) console.error(e.details);
    } else {
      console.error(e);
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

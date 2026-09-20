#!/bin/sh
set -e
echo "[boot] prisma db push"
npx prisma db push
echo "[boot] check seed"
npx tsx <<'TS'
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "child_process";
const p = new PrismaClient();
const n = await p.organization.count();
await p.$disconnect();
if (n === 0) {
  console.log("[boot] seeding");
  const r = spawnSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
console.log("[boot] skip seed, orgs=", n);
TS
echo "[boot] starting next"
exec npx next start -H 0.0.0.0 -p ${PORT:-3000}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function nextWo(organizationId: string, n: number) {
  const id = `wo:${organizationId}`;
  await prisma.counter.upsert({
    where: { id },
    create: { id, value: n },
    update: { value: n },
  });
}

async function main() {
  console.log("Seeding MEUT multi-tenant demo data...");

  await prisma.workOrder.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.department.deleteMany();
  await prisma.serviceContract.deleteMany();
  await prisma.hospital.deleteMany();
  await prisma.user.deleteMany();
  await prisma.manufacturer.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.counter.deleteMany();
  await prisma.organization.deleteMany();

  const hash = await bcrypt.hash("password", 10);
  const twHash = await bcrypt.hash(process.env.MEUT_CREATOR_PASSWORD || 'Meut-6lk8pW698NYp!', 10);

  // --- Platform demo org (full seed data) ---
  const demoOrg = await prisma.organization.create({
    data: {
      name: "MEUT Demo",
      slug: "meut-demo",
      tier: "CREATOR",
      active: true,
    },
  });

  // --- Second tenant for isolation testing ---
  const acmeOrg = await prisma.organization.create({
    data: {
      name: "Acme Clinical",
      slug: "acme-clinical",
      tier: "STARTER",
      active: true,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      organizationId: demoOrg.id,
      techId: "SUP",
      username: "supervisor",
      name: "Pat Supervisor",
      firstName: "Pat",
      lastName: "Supervisor",
      passwordHash: hash,
      role: "SUPERVISOR",
      initials: "PS",
      securityLevel: 9,
      jobTitle: "Biomed Supervisor",
    },
  });


  await prisma.user.create({
    data: {
      organizationId: demoOrg.id,
      techId: "TW",
      username: "tw",
      name: "Travis Woods",
      firstName: "Travis",
      lastName: "Woods",
      passwordHash: twHash,
      role: "SUPERVISOR",
      initials: "TW",
      securityLevel: 9,
      jobTitle: "Creator",
    },
  });

  const tech = await prisma.user.create({
    data: {
      organizationId: demoOrg.id,
      techId: "JT",
      username: "tech",
      name: "Jordan Tech",
      firstName: "Jordan",
      lastName: "Tech",
      passwordHash: hash,
      role: "TECH",
      initials: "JT",
      securityLevel: 3,
      jobTitle: "Biomed Tech",
    },
  });

  await prisma.user.create({
    data: {
      organizationId: demoOrg.id,
      techId: "AL",
      username: "alex",
      name: "Alex Rivera",
      firstName: "Alex",
      lastName: "Rivera",
      passwordHash: hash,
      role: "TECH",
      initials: "AL",
      securityLevel: 3,
      jobTitle: "Biomed Tech II",
    },
  });

  await prisma.user.create({
    data: {
      organizationId: acmeOrg.id,
      techId: "SUP",
      username: "acme_admin",
      name: "Casey Acme",
      firstName: "Casey",
      lastName: "Acme",
      passwordHash: hash,
      role: "SUPERVISOR",
      initials: "CA",
      securityLevel: 9,
      jobTitle: "Biomed Supervisor",
    },
  });

  const hospital = await prisma.hospital.create({
    data: {
      organizationId: demoOrg.id,
      hospId: "DEMO",
      name: "Demo General Hospital",
      address: "100 Health Way",
      city: "Springfield",
      state: "IL",
      zip: "62701",
      phone: "217-555-0100",
      contact: "Clinical Engineering",
      beds: 250,
    },
  });

  const northHospital = await prisma.hospital.create({
    data: {
      organizationId: demoOrg.id,
      hospId: "NORTH",
      name: "Northside Clinic",
      address: "50 North Ave",
      city: "Springfield",
      state: "IL",
      zip: "62702",
      phone: "217-555-0200",
      contact: "Clinic Manager",
      beds: 40,
    },
  });

  await prisma.user.create({
    data: {
      organizationId: demoOrg.id,
      username: "customer",
      name: "Chris Customer",
      firstName: "Chris",
      lastName: "Customer",
      passwordHash: hash,
      role: "CUSTOMER",
      hospitalId: hospital.id,
      jobTitle: "Facility Contact",
      email: "customer@demo-general.example",
    },
  });

  const acmeHospital = await prisma.hospital.create({
    data: {
      organizationId: acmeOrg.id,
      hospId: "ACME",
      name: "Acme Memorial",
      address: "1 Acme Parkway",
      city: "Peoria",
      state: "IL",
      zip: "61602",
      phone: "309-555-0100",
      contact: "Clinical Engineering",
      beds: 120,
    },
  });

  const icu = await prisma.department.create({
    data: {
      organizationId: demoOrg.id,
      hospitalId: hospital.id,
      hospId: "DEMO",
      costCtr: "ICU",
      name: "Intensive Care Unit",
      manager: "Nurse Manager",
      phone: "217-555-0110",
      defaultTech: "JT",
    },
  });

  const or = await prisma.department.create({
    data: {
      organizationId: demoOrg.id,
      hospitalId: hospital.id,
      hospId: "DEMO",
      costCtr: "OR",
      name: "Operating Room",
      manager: "OR Director",
      phone: "217-555-0120",
      defaultTech: "AL",
    },
  });

  const ed = await prisma.department.create({
    data: {
      organizationId: demoOrg.id,
      hospitalId: hospital.id,
      hospId: "DEMO",
      costCtr: "ED",
      name: "Emergency Department",
      phone: "217-555-0130",
    },
  });

  await prisma.department.create({
    data: {
      organizationId: acmeOrg.id,
      hospitalId: acmeHospital.id,
      hospId: "ACME",
      costCtr: "BIO",
      name: "Biomed Shop",
      phone: "309-555-0110",
    },
  });

  const now = new Date();
  const nextYear = new Date(now);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const lastMonth = new Date(now);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const eq1 = await prisma.equipment.create({
    data: {
      organizationId: demoOrg.id,
      controlNum: "DEMO-1001",
      hospId: "DEMO",
      costCtr: "ICU",
      serial: "SN-ICU-001",
      manufacturer: "Philips",
      model: "IntelliVue MX40",
      description: "Patient Monitor",
      location: "ICU-12",
      building: "Main",
      hospitalId: hospital.id,
      departmentId: icu.id,
      status: "ACTIVE",
      onPm: true,
      pmSchedule1: "Q",
      pmProc1: "PM-MON",
      techAssigned1: "JT",
      purchaseDate: new Date("2022-03-15"),
      purchaseCost: 12500,
      warrantyLaborEnd: lastMonth,
      comments: "Demo seed equipment",
    },
  });

  const eq2 = await prisma.equipment.create({
    data: {
      organizationId: demoOrg.id,
      controlNum: "DEMO-2001",
      hospId: "DEMO",
      costCtr: "OR",
      serial: "SN-OR-442",
      manufacturer: "GE Healthcare",
      model: "Aisys CS2",
      description: "Anesthesia Machine",
      location: "OR-3",
      hospitalId: hospital.id,
      departmentId: or.id,
      status: "ACTIVE",
      onPm: true,
      pmSchedule1: "A",
      pmProc1: "PM-ANES",
      techAssigned1: "AL",
      purchaseCost: 48000,
      warrantyPartsEnd: nextYear,
    },
  });

  const eq3 = await prisma.equipment.create({
    data: {
      organizationId: demoOrg.id,
      controlNum: "DEMO-3001",
      hospId: "DEMO",
      costCtr: "ED",
      serial: "SN-ED-77",
      manufacturer: "Zoll",
      model: "R Series",
      description: "Defibrillator",
      location: "Trauma 1",
      hospitalId: hospital.id,
      departmentId: ed.id,
      status: "ACTIVE",
      onPm: true,
      pmSchedule1: "S",
      pmProc1: "PM-DEF",
      techAssigned1: "JT",
    },
  });

  await prisma.equipment.create({
    data: {
      organizationId: demoOrg.id,
      controlNum: "DEMO-9999",
      hospId: "DEMO",
      costCtr: "ICU",
      serial: "OLD-001",
      manufacturer: "Obsolete Co",
      model: "Legacy",
      description: "Retired Infusion Pump",
      hospitalId: hospital.id,
      departmentId: icu.id,
      status: "RETIRED",
      onPm: false,
      dateRetired: new Date("2024-01-01"),
    },
  });

  await prisma.equipment.create({
    data: {
      organizationId: demoOrg.id,
      controlNum: "NORTH-1001",
      hospId: "NORTH",
      serial: "NORTH-SN-1",
      manufacturer: "Mindray",
      model: "BeneVision",
      description: "Northside-only monitor (customer isolation test)",
      hospitalId: northHospital.id,
      status: "ACTIVE",
      onPm: false,
    },
  });

  await prisma.equipment.create({
    data: {
      organizationId: acmeOrg.id,
      controlNum: "ACME-1001",
      hospId: "ACME",
      costCtr: "BIO",
      serial: "ACME-SN-1",
      manufacturer: "Philips",
      model: "Secret Tenant Device",
      description: "Acme-only monitor (isolation test)",
      hospitalId: acmeHospital.id,
      status: "ACTIVE",
      onPm: false,
    },
  });

  await prisma.serviceContract.create({
    data: {
      organizationId: demoOrg.id,
      contractNum: "SC-2025-001",
      name: "Philips Critical Care Bundle",
      vendorName: "Philips Healthcare",
      hospitalId: hospital.id,
      hospId: "DEMO",
      customerName: "Demo General Hospital",
      startDate: new Date("2025-01-01"),
      expirationDate: new Date("2026-12-31"),
      contractCost: 85000,
      coverageSummary: "ICU monitors & telemetry",
      notes: "Includes parts and labor",
    },
  });

  await prisma.serviceContract.create({
    data: {
      organizationId: demoOrg.id,
      contractNum: "SC-EXP-001",
      name: "Expired GE Imaging",
      vendorName: "GE Healthcare",
      hospitalId: hospital.id,
      hospId: "DEMO",
      startDate: new Date("2023-01-01"),
      expirationDate: new Date("2025-06-30"),
      contractCost: 12000,
      active: false,
    },
  });

  await prisma.manufacturer.createMany({
    data: [
      { organizationId: demoOrg.id, manfNum: "PHIL", name: "Philips" },
      { organizationId: demoOrg.id, manfNum: "GEHC", name: "GE Healthcare" },
      { organizationId: demoOrg.id, manfNum: "ZOLL", name: "Zoll" },
    ],
  });

  await prisma.vendor.create({
    data: {
      organizationId: demoOrg.id,
      vendorId: "V001",
      name: "Philips Healthcare",
      phone: "800-555-0199",
    },
  });

  await prisma.workOrder.create({
    data: {
      organizationId: demoOrg.id,
      woNumber: 1001,
      type: "CM",
      status: "OPEN",
      equipmentId: eq1.id,
      controlNum: eq1.controlNum,
      hospId: "DEMO",
      costCtr: "ICU",
      workRequested: "Monitor intermittently loses SpO2 reading",
      priority: "URGENT",
      openedById: supervisor.id,
      assignedTechId: tech.id,
      assignedTechCode: "JT",
      dateOpened: new Date(),
    },
  });

  await prisma.workOrder.create({
    data: {
      organizationId: demoOrg.id,
      woNumber: 1002,
      type: "CM",
      status: "CLOSED",
      equipmentId: eq3.id,
      controlNum: eq3.controlNum,
      hospId: "DEMO",
      costCtr: "ED",
      workRequested: "Battery warning chirp",
      workPerformed: "Replaced battery pack; self-test passed",
      laborHours: 0.75,
      priority: "ROUTINE",
      openedById: tech.id,
      assignedTechId: tech.id,
      closedById: tech.id,
      dateOpened: lastMonth,
      dateClosed: lastMonth,
    },
  });

  await prisma.workOrder.create({
    data: {
      organizationId: demoOrg.id,
      woNumber: 1003,
      type: "PM",
      status: "OPEN",
      equipmentId: eq2.id,
      controlNum: eq2.controlNum,
      hospId: "DEMO",
      costCtr: "OR",
      workRequested: "Scheduled preventive maintenance",
      pmMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      pmProc1: "PM-ANES",
      pmSchedule1: "A",
      assignedTechId: tech.id,
      assignedTechCode: "AL",
      openedById: supervisor.id,
    },
  });

  await nextWo(demoOrg.id, 1003);
  await nextWo(acmeOrg.id, 1000);

  console.log("Seed complete.");
  console.log("  Org MEUT Demo:  tw / password         (CREATOR / SUPERVISOR)");
  console.log("                  supervisor / password  (SUPERVISOR)");
  console.log("                  tech / password         (TECH)");
  console.log("                  alex / password         (TECH)");
  console.log("                  customer / password     (CUSTOMER @ Demo General Hospital)");
  console.log("  Org Acme Clinical: acme_admin / password (SUPERVISOR)");
  console.log("  License: Demo=CREATOR (no Stripe), Acme=STARTER (no Stripe — app access blocked)");
  console.log("  Isolation: Demo must NOT see ACME / Acme Memorial");
  console.log("  Customer portal: customer sees DEMO hospital only (not Northside / ACME)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

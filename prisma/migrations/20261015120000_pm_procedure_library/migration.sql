-- Additive PM procedure library.
-- Safe on databases that already have production equipment and work orders:
-- new tables only, plus nullable columns on Equipment and WorkOrder.
-- IF NOT EXISTS / duplicate_object guards keep this safe if `prisma db push`
-- already applied the same schema (Railway boot uses db push).

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN IF NOT EXISTS "pmTemplateId" TEXT;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "pmProcedureSource" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "pmTemplateId" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "pmTemplateName" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "pmTemplateVersion" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PmProcedureTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL DEFAULT '',
    "aliases" TEXT NOT NULL DEFAULT '',
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "customized" BOOLEAN NOT NULL DEFAULT false,
    "seedKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmProcedureTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PmProcedureStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "stepType" TEXT NOT NULL DEFAULT 'PASS_FAIL',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "unit" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmProcedureStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PmProcedureSeedDismissal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "seedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PmProcedureSeedDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PmProcedureTemplate_organizationId_idx" ON "PmProcedureTemplate"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PmProcedureTemplate_organizationId_active_idx" ON "PmProcedureTemplate"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PmProcedureTemplate_organizationId_seedKey_key" ON "PmProcedureTemplate"("organizationId", "seedKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PmProcedureStep_templateId_sortOrder_idx" ON "PmProcedureStep"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PmProcedureSeedDismissal_organizationId_idx" ON "PmProcedureSeedDismissal"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PmProcedureSeedDismissal_organizationId_seedKey_key" ON "PmProcedureSeedDismissal"("organizationId", "seedKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Equipment_pmTemplateId_idx" ON "Equipment"("pmTemplateId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_pmTemplateId_fkey" FOREIGN KEY ("pmTemplateId") REFERENCES "PmProcedureTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PmProcedureTemplate" ADD CONSTRAINT "PmProcedureTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PmProcedureStep" ADD CONSTRAINT "PmProcedureStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PmProcedureTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PmProcedureSeedDismissal" ADD CONSTRAINT "PmProcedureSeedDismissal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/ui";
import { requireOrgSession } from "@/lib/tenant";
import { ReportGeneratorForm } from "@/components/report-generator-form";
import { ReportResults } from "@/components/report-results";
import {
  fetchReportData,
  loadReportFormOptions,
  parseReportFilters,
  type ReportFilterParams,
} from "@/lib/report-filters";
import {
  ClipboardList,
  CalendarCheck,
  Wrench,
  FileText,
  FilePlus,
  Printer,
} from "lucide-react";

export const dynamic = "force-dynamic";

const shortcutLinks = [
  {
    href: "/reports?type=cm&status=OPEN",
    title: "Open CM work orders",
    description: "Quick start — open corrective maintenance",
    icon: ClipboardList,
  },
  {
    href: "/reports?type=pm&status=OPEN",
    title: "Open PM work orders",
    description: "Quick start — open preventive maintenance",
    icon: CalendarCheck,
  },
  {
    href: "/reports?type=equipment&status=ACTIVE",
    title: "Active equipment",
    description: "Quick start — active device inventory",
    icon: Wrench,
  },
  {
    href: "/reports?type=contracts&status=ACTIVE",
    title: "Active contracts",
    description: "Quick start — contracts & warranties",
    icon: FileText,
  },
  {
    href: "/cm-work-orders/blank/print",
    title: "Blank CM work order form",
    description: "Empty printable form for handwriting / field use",
    icon: FilePlus,
  },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: ReportFilterParams;
}) {
  const { organizationId } = await requireOrgSession();
  const filters = parseReportFilters(searchParams);

  const [
    byDept,
    openCm,
    openPm,
    closedCm,
    activeEq,
    retiredEq,
    onPm,
    contracts,
    formOptions,
    reportData,
  ] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId },
      include: { _count: { select: { equipment: true } }, hospital: true },
      orderBy: { name: "asc" },
    }),
    prisma.workOrder.count({
      where: { organizationId, type: "CM", status: "OPEN" },
    }),
    prisma.workOrder.count({
      where: { organizationId, type: "PM", status: "OPEN" },
    }),
    prisma.workOrder.count({
      where: { organizationId, type: "CM", status: "CLOSED" },
    }),
    prisma.equipment.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.equipment.count({ where: { organizationId, status: "RETIRED" } }),
    prisma.equipment.count({
      where: { organizationId, onPm: true, status: "ACTIVE" },
    }),
    prisma.serviceContract.count({ where: { organizationId, active: true } }),
    loadReportFormOptions(organizationId),
    filters.type
      ? fetchReportData(organizationId, filters)
      : Promise.resolve(null),
  ]);

  let facilityName: string | null = null;
  let techName: string | null = null;
  if (filters.facilityId) {
    facilityName =
      formOptions.facilities.find((f) => f.id === filters.facilityId)?.name ||
      null;
  }
  if (filters.techId) {
    techName =
      formOptions.techs.find((t) => t.id === filters.techId)?.name || null;
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Choose what to print, set filters, then generate or print that exact selection"
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Equipment" value={activeEq} tone="sky" />
        <StatCard label="Retired" value={retiredEq} tone="slate" />
        <StatCard label="On PM" value={onPm} tone="emerald" />
        <StatCard label="Active Contracts" value={contracts} tone="amber" />
        <StatCard label="Open CM" value={openCm} tone="rose" />
        <StatCard label="Open PM" value={openPm} tone="amber" />
        <StatCard label="Closed CM" value={closedCm} tone="emerald" />
      </div>

      <ReportGeneratorForm
        facilities={formOptions.facilities}
        techs={formOptions.techs}
        defaults={{
          type: searchParams.type,
          facility: searchParams.facility,
          status: searchParams.status,
          from: searchParams.from,
          to: searchParams.to,
          tech: searchParams.tech,
          pmResult: searchParams.pmResult,
        }}
      />

      {reportData && filters.type ? (
        <ReportResults
          filters={filters}
          data={reportData}
          facilityName={facilityName}
          techName={techName}
        />
      ) : null}

      <div className="mt-10 mb-3">
        <h2 className="text-lg font-semibold">Shortcuts</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Optional quick starts — same chooser workflow, pre-filled filters
        </p>
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shortcutLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="card group flex gap-3 transition hover:border-brand-300 hover:shadow-card"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 group-hover:bg-brand-100">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  {item.title}
                  <Printer className="h-3.5 w-3.5 text-slate-400" />
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Equipment Count by Department</h2>
        <Link
          href="/reports?type=equipment&status=ACTIVE"
          className="btn-secondary text-xs"
        >
          Open inventory report
        </Link>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Facility</th>
              <th>Cost Ctr</th>
              <th>Department</th>
              <th>Equipment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {byDept.map((d) => (
              <tr key={d.id}>
                <td>{d.hospital.name}</td>
                <td>{d.costCtr}</td>
                <td>{d.name}</td>
                <td className="font-medium">{d._count.equipment}</td>
              </tr>
            ))}
            {byDept.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400">
                  No departments
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

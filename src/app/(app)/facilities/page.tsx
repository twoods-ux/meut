import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { createHospital, createDepartment } from "@/lib/actions";
import { getLicenseState } from "@/lib/license-server";
import { LICENSE_UPGRADE_MESSAGE } from "@/lib/license";
import { requireOrgSession } from "@/lib/tenant";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage() {
  const { organizationId } = await requireOrgSession();
  const [hospitals, license] = await Promise.all([
    prisma.hospital.findMany({
      where: { organizationId },
      include: { departments: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    getLicenseState(organizationId),
  ]);

  async function addHospital(formData: FormData) {
    "use server";
    await createHospital(formData);
  }
  async function addDepartment(formData: FormData) {
    "use server";
    await createDepartment(formData);
  }

  return (
    <div>
      <PageHeader
        title="Facilities"
        subtitle="Hospital Information & Department Information"
        actions={
          <div className="rounded-xl border border-brand-100 bg-brand-50/80 px-3.5 py-2 text-sm text-slate-600 shadow-soft">
            Plan:{" "}
            <span className="font-semibold text-brand-700">
              {license.definition.name}
            </span>
            <span className="mx-2 text-slate-300">·</span>
            Facilities:{" "}
            <span className="font-semibold text-slate-900">{license.usage}</span>
          </div>
        }
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <form action={addHospital} className="card space-y-3">
          <h2 className="section-title">Add Hospital</h2>
          {!license.canAdd && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium">{LICENSE_UPGRADE_MESSAGE}</p>
              <p className="mt-1 text-amber-800/80">
                You are using {license.usage} facilities on the{" "}
                {license.definition.name} plan.{" "}
                <Link href="/settings" className="font-semibold underline">
                  View plans / upgrade
                </Link>
              </p>
            </div>
          )}
          <fieldset disabled={!license.canAdd} className="space-y-3 disabled:opacity-60">
            <div>
              <label className="label">HospID *</label>
              <input className="input" name="hospId" required placeholder="e.g. MAIN" />
            </div>
            <div>
              <label className="label">Name *</label>
              <input className="input" name="name" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">City</label>
                <input className="input" name="city" />
              </div>
              <div>
                <label className="label">State</label>
                <input className="input" name="state" />
              </div>
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" name="phone" />
            </div>
            <button type="submit" className="btn-primary" disabled={!license.canAdd}>
              Save Hospital
            </button>
          </fieldset>
        </form>

        <form action={addDepartment} className="card space-y-3">
          <h2 className="section-title">Add Department</h2>
          <div>
            <label className="label">Hospital *</label>
            <select className="input" name="hospitalId" required>
              <option value="">Select…</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>{h.hospId} — {h.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Cost Center *</label>
            <input className="input" name="costCtr" required placeholder="e.g. ICU" />
          </div>
          <div>
            <label className="label">Department Name *</label>
            <input className="input" name="name" required />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" name="phone" />
          </div>
          <div>
            <label className="label">Manager</label>
            <input className="input" name="manager" />
          </div>
          <button type="submit" className="btn-primary">Save Department</button>
        </form>
      </div>

      <div className="space-y-6">
        {hospitals.map((h) => (
          <div key={h.id} className="card">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{h.name}</h3>
                <p className="text-sm text-slate-500">
                  ID {h.hospId}
                  {h.city ? ` · ${h.city}, ${h.state || ""}` : ""}
                  {h.phone ? ` · ${h.phone}` : ""}
                </p>
              </div>
              <span className="badge bg-slate-100 text-slate-700">{h.departments.length} depts</span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cost Ctr</th>
                    <th>Department</th>
                    <th>Manager</th>
                    <th>Phone</th>
                    <th>Default Tech</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {h.departments.map((d) => (
                    <tr key={d.id}>
                      <td className="font-medium">{d.costCtr}</td>
                      <td>{d.name}</td>
                      <td>{d.manager || "—"}</td>
                      <td>{d.phone || "—"}</td>
                      <td>{d.defaultTech || "—"}</td>
                    </tr>
                  ))}
                  {h.departments.length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-slate-400">No departments</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {hospitals.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-soft">
            No hospitals yet. Add one above or import the Access MDB.
          </div>
        )}
      </div>
    </div>
  );
}

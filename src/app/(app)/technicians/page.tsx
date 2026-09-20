import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";
import { createTechnician, createCustomerUser } from "@/lib/actions";
import { getLicenseState } from "@/lib/license-server";
import { SEAT_UPGRADE_MESSAGE } from "@/lib/license";
import Link from "next/link";
import { requireStaffSession } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function TechniciansPage() {
  const { organizationId } = await requireStaffSession();
  const [users, hospitals, license] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId },
      include: { hospital: true },
      orderBy: { name: "asc" },
    }),
    prisma.hospital.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    getLicenseState(organizationId),
  ]);

  async function addTech(formData: FormData) {
    "use server";
    await createTechnician(formData);
  }

  async function addCustomer(formData: FormData) {
    "use server";
    await createCustomerUser(formData);
  }

  return (
    <div>
      <PageHeader
        title="Technicians / Users"
        subtitle="Staff accounts and customer portal users (facility contacts)"
        actions={
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            Plan:{" "}
            <span className="font-semibold text-[#4070D0]">
              {license.definition.name}
            </span>
            <span className="mx-2 text-slate-300">·</span>
            Seats:{" "}
            <span className="font-semibold text-slate-900">{license.seatUsage}</span>
          </div>
        }
      />

      <form action={addTech} className="card mb-8 space-y-3">
        <h2 className="font-semibold">Add Technician</h2>
        {!license.canAddUser && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-medium">{SEAT_UPGRADE_MESSAGE}</p>
            <p className="mt-1 text-amber-800/80">
              You are using {license.seatUsage} active seats on the{" "}
              {license.definition.name} plan.{" "}
              <Link href="/settings" className="font-semibold underline">
                View plans / upgrade
              </Link>
            </p>
          </div>
        )}
        <fieldset
          disabled={!license.canAddUser}
          className="grid gap-3 disabled:opacity-60 md:grid-cols-3"
        >
          <div>
            <label className="label">Username *</label>
            <input className="input" name="username" required />
          </div>
          <div>
            <label className="label">Full Name *</label>
            <input className="input" name="name" required />
          </div>
          <div>
            <label className="label">TechID</label>
            <input className="input" name="techId" placeholder="e.g. JT" />
          </div>
          <div>
            <label className="label">Initials</label>
            <input className="input" name="initials" />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" name="role" defaultValue="TECH">
              <option value="TECH">Tech</option>
              <option value="SUPERVISOR">Supervisor</option>
            </select>
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              name="password"
              type="password"
              defaultValue="password"
            />
          </div>
          <div>
            <label className="label">Job Title</label>
            <input className="input" name="jobTitle" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </fieldset>
      </form>

      <form action={addCustomer} className="card mb-8 space-y-3">
        <h2 className="font-semibold">Add Customer Portal User</h2>
        <p className="text-sm text-slate-500">
          Creates a read-only login for a facility contact. They see inventory
          and work orders for the selected hospital only. Counts toward seat
          limit.
        </p>
        {!license.canAddUser && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-medium">{SEAT_UPGRADE_MESSAGE}</p>
            <Link href="/settings" className="font-semibold underline">
              View plans / upgrade
            </Link>
          </div>
        )}
        <fieldset
          disabled={!license.canAddUser || hospitals.length === 0}
          className="grid gap-3 disabled:opacity-60 md:grid-cols-3"
        >
          <div>
            <label className="label">Username *</label>
            <input className="input" name="username" required />
          </div>
          <div>
            <label className="label">Full Name *</label>
            <input className="input" name="name" required />
          </div>
          <div>
            <label className="label">Facility *</label>
            <select className="input" name="hospitalId" required defaultValue="">
              <option value="" disabled>
                Select hospital…
              </option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.hospId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Password *</label>
            <input
              className="input"
              name="password"
              type="password"
              required
              minLength={6}
              defaultValue="password"
            />
          </div>
          <div>
            <label className="label">Job Title</label>
            <input
              className="input"
              name="jobTitle"
              placeholder="Facility Contact"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" name="email" type="email" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary">
              Create customer user
            </button>
          </div>
        </fieldset>
        {hospitals.length === 0 && (
          <p className="text-sm text-amber-700">
            Add a facility first before creating customer users.
          </p>
        )}
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>TechID</th>
              <th>Role</th>
              <th>Facility</th>
              <th>Title</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td>{u.username}</td>
                <td>{u.techId || "—"}</td>
                <td>
                  <StatusBadge status={u.role} />
                </td>
                <td>
                  {u.role === "CUSTOMER"
                    ? u.hospital?.name || "—"
                    : "—"}
                </td>
                <td>{u.jobTitle || "—"}</td>
                <td>{u.active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

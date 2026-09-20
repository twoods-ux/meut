import { createEquipment, updateEquipment } from "@/lib/actions";
import { toDateInputValue } from "@/lib/pm";
import { redirect } from "next/navigation";

type Hospital = { id: string; name: string; hospId: string };
type Dept = { id: string; name: string; costCtr: string; hospitalId: string };
type Equip = {
  id?: string;
  controlNum: string;
  serial: string | null;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  location: string | null;
  hospitalId: string | null;
  departmentId: string | null;
  status: string;
  onPm: boolean;
  pmSchedule1: string | null;
  pmProc1: string | null;
  techAssigned1?: string | null;
  pmNextDue?: Date | string | null;
  pmLastCompleted?: Date | string | null;
  comments: string | null;
  risk: string | null;
};

export function EquipmentForm({
  equipment,
  hospitals,
  departments,
}: {
  equipment?: Equip;
  hospitals: Hospital[];
  departments: Dept[];
}) {
  // Close over a plain string only — Next.js serializes server-action closures.
  // Capturing the full Prisma `equipment` (or `equipment` when undefined) crashes
  // /equipment/new with: Cannot read properties of undefined (reading 'id').
  const equipmentId = equipment?.id;

  async function action(formData: FormData) {
    "use server";
    if (equipmentId) {
      await updateEquipment(equipmentId, formData);
      redirect(`/equipment/${equipmentId}`);
    } else {
      await createEquipment(formData);
      redirect("/equipment");
    }
  }

  return (
    <form action={action} className="card grid gap-4 md:grid-cols-2">
      <div>
        <label className="label">Control Number *</label>
        <input className="input" name="controlNum" required defaultValue={equipment?.controlNum || ""} />
      </div>
      <div>
        <label className="label">Serial</label>
        <input className="input" name="serial" defaultValue={equipment?.serial || ""} />
      </div>
      <div>
        <label className="label">Manufacturer</label>
        <input className="input" name="manufacturer" defaultValue={equipment?.manufacturer || ""} />
      </div>
      <div>
        <label className="label">Model</label>
        <input className="input" name="model" defaultValue={equipment?.model || ""} />
      </div>
      <div className="md:col-span-2">
        <label className="label">Description</label>
        <input className="input" name="description" defaultValue={equipment?.description || ""} />
      </div>
      <div>
        <label className="label">Location</label>
        <input className="input" name="location" defaultValue={equipment?.location || ""} />
      </div>
      <div>
        <label className="label">Status</label>
        <select className="input" name="status" defaultValue={equipment?.status || "ACTIVE"}>
          <option value="ACTIVE">Active</option>
          <option value="RETIRED">Retired</option>
        </select>
      </div>
      <div>
        <label className="label">Risk</label>
        <select className="input" name="risk" defaultValue={equipment?.risk || ""}>
          <option value="">—</option>
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          {equipment?.risk &&
          !["0", "1", "2", "3", "4", "Low", "Medium", "High"].includes(equipment.risk) ? (
            <option value={equipment.risk}>{equipment.risk}</option>
          ) : null}
        </select>
      </div>
      <div>
        <label className="label">Hospital</label>
        <select className="input" name="hospitalId" defaultValue={equipment?.hospitalId || ""}>
          <option value="">—</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>{h.hospId} — {h.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Department</label>
        <select className="input" name="departmentId" defaultValue={equipment?.departmentId || ""}>
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.costCtr} — {d.name}</option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="onPm" defaultChecked={equipment?.onPm} value="true" />
          Include in PM program
        </label>
      </div>
      <div>
        <label className="label">PM Schedule</label>
        <select className="input" name="pmSchedule1" defaultValue={equipment?.pmSchedule1 || ""}>
          <option value="">—</option>
          <option value="M">Monthly</option>
          <option value="Q">Quarterly</option>
          <option value="S">Semi-Annual</option>
          <option value="A">Annual</option>
          {equipment?.pmSchedule1 &&
          !["M", "Q", "S", "A"].includes(equipment.pmSchedule1) ? (
            <option value={equipment.pmSchedule1}>{equipment.pmSchedule1}</option>
          ) : null}
        </select>
      </div>
      <div>
        <label className="label">Next due</label>
        <input
          className="input"
          type="date"
          name="pmNextDue"
          defaultValue={toDateInputValue(equipment?.pmNextDue)}
        />
      </div>
      <div>
        <label className="label">Last completed</label>
        <input
          className="input"
          type="date"
          name="pmLastCompleted"
          defaultValue={toDateInputValue(equipment?.pmLastCompleted)}
        />
      </div>
      <div>
        <label className="label">Default tech code</label>
        <input
          className="input"
          name="techAssigned1"
          defaultValue={equipment?.techAssigned1 || ""}
          placeholder="Tech ID"
        />
      </div>
      <div className="md:col-span-2">
        <label className="label">PM steps (procedure)</label>
        <textarea
          className="input"
          name="pmProc1"
          rows={4}
          defaultValue={equipment?.pmProc1 || ""}
          placeholder={"One step per line, e.g.\n1. Visual inspection\n2. Functional test\n3. Safety check"}
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Each line becomes a step on the PM work order when you generate PMs.
        </p>
      </div>
      <div className="md:col-span-2">
        <label className="label">Comments</label>
        <textarea className="input" name="comments" rows={3} defaultValue={equipment?.comments || ""} />
      </div>
      <div className="md:col-span-2 flex gap-2">
        <button type="submit" className="btn-primary">Save</button>
      </div>
    </form>
  );
}

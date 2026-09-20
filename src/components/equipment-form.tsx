import { createEquipment, updateEquipment } from "@/lib/actions";
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
  comments: string | null;
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
  async function action(formData: FormData) {
    "use server";
    if (equipment?.id) {
      await updateEquipment(equipment.id, formData);
      redirect(`/equipment/${equipment.id}`);
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
          On PM Schedule (EquipOnPM)
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
        </select>
      </div>
      <div>
        <label className="label">PM Procedure</label>
        <input className="input" name="pmProc1" defaultValue={equipment?.pmProc1 || ""} />
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

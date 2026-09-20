"use client";

import { useMemo, useState } from "react";

type Facility = { id: string; name: string; hospId: string };
type Equipment = {
  id: string;
  controlNum: string;
  description: string | null;
  model: string | null;
  manufacturer: string | null;
  hospitalId: string | null;
  hospId: string | null;
};

export function FacilityEquipmentSelect({
  facilities,
  equipment,
  initialFacilityId = "ALL",
  initialEquipmentId = "",
}: {
  facilities: Facility[];
  equipment: Equipment[];
  initialFacilityId?: string;
  initialEquipmentId?: string;
}) {
  const [facilityId, setFacilityId] = useState(initialFacilityId || "ALL");
  const [equipmentId, setEquipmentId] = useState(initialEquipmentId);
  const selectedFacility = facilities.find((f) => f.id === facilityId);
  const visibleEquipment = useMemo(() => {
    if (!selectedFacility || facilityId === "ALL") return equipment;
    return equipment.filter(
      (e) =>
        e.hospitalId === selectedFacility.id || e.hospId === selectedFacility.hospId
    );
  }, [equipment, facilityId, selectedFacility]);

  return (
    <>
      <div>
        <label className="label" htmlFor="cm-facility">
          Facility
        </label>
        <select
          className="input"
          id="cm-facility"
          name="facility"
          value={facilityId}
          onChange={(event) => {
            const nextFacilityId = event.target.value;
            setFacilityId(nextFacilityId);
            const nextFacility = facilities.find((f) => f.id === nextFacilityId);
            if (
              equipmentId &&
              nextFacility &&
              !equipment.some(
                (e) =>
                  e.id === equipmentId &&
                  (e.hospitalId === nextFacility.id || e.hospId === nextFacility.hospId)
              )
            ) {
              setEquipmentId("");
            }
          }}
        >
          <option value="ALL">All facilities</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.hospId})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="cm-equipment">
          Equipment (Control #) *
        </label>
        <select
          className="input"
          id="cm-equipment"
          name="equipmentId"
          required
          value={equipmentId}
          onChange={(event) => setEquipmentId(event.target.value)}
        >
          <option value="">Select…</option>
          {visibleEquipment.map((e) => (
            <option key={e.id} value={e.id}>
              {e.controlNum} — {e.description || e.model || e.manufacturer || "equipment"}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

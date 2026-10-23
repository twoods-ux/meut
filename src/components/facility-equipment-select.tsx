"use client";

import { useEffect, useState, useTransition } from "react";
import { lookupEquipmentByControlNum } from "@/lib/actions";

type Facility = { id: string; name: string; hospId: string };
type EquipmentMatch = {
  id: string;
  controlNum: string;
  description: string | null;
  model: string | null;
  manufacturer: string | null;
  serial: string | null;
  deviceNum: string | null;
  location: string | null;
  hospId: string | null;
};

function detailLine(e: EquipmentMatch) {
  const parts = [
    e.description || e.model || e.manufacturer || "equipment",
  ];
  if (e.serial) parts.push(`SN ${e.serial}`);
  if (e.deviceNum) parts.push(`Asset ${e.deviceNum}`);
  if (e.hospId) parts.push(e.hospId);
  if (e.location) parts.push(e.location);
  return parts.join(" · ");
}

export function FacilityEquipmentSelect({
  facilities,
  initialFacilityId = "ALL",
  initialEquipment = null,
}: {
  facilities: Facility[];
  initialFacilityId?: string;
  initialEquipment?: EquipmentMatch | null;
}) {
  const [facilityId, setFacilityId] = useState(initialFacilityId || "ALL");
  const [query, setQuery] = useState(initialEquipment?.controlNum || "");
  const [selected, setSelected] = useState<EquipmentMatch | null>(
    initialEquipment
  );
  const [matches, setMatches] = useState<EquipmentMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startLookup] = useTransition();
  const [lookupError, setLookupError] = useState("");

  useEffect(() => {
    const q = query.trim();
    if (selected && selected.controlNum.toLowerCase() === q.toLowerCase()) {
      setMatches([]);
      setOpen(false);
      return;
    }
    if (!q) {
      setMatches([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      startLookup(async () => {
        try {
          const rows = await lookupEquipmentByControlNum(q, facilityId);
          if (cancelled) return;
          setMatches(rows);
          setOpen(true);
          setLookupError("");
          const exact = rows.filter(
            (row) => row.controlNum.toLowerCase() === q.toLowerCase()
          );
          if (exact.length === 1) setSelected(exact[0]);
        } catch (error) {
          if (cancelled) return;
          setMatches([]);
          setLookupError(
            error instanceof Error ? error.message : "Equipment lookup failed"
          );
        }
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, facilityId, selected]);

  function pick(equipment: EquipmentMatch) {
    setSelected(equipment);
    setQuery(equipment.controlNum);
    setMatches([]);
    setOpen(false);
    setLookupError("");
  }

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
          onChange={(event) => setFacilityId(event.target.value)}
        >
          <option value="ALL">All facilities</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.hospId})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Narrows suggestions. An exact control number is still found if the
          equipment facility link does not match.
        </p>
      </div>
      <div className="relative">
        <label className="label" htmlFor="cm-equipment">
          Equipment *
        </label>
        <input
          id="cm-equipment"
          className="input"
          name="controlNum"
          value={query}
          autoComplete="off"
          required
          placeholder="Control #, serial / asset, or description"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setOpen(true);
          }}
          onFocus={() => {
            if (matches.length > 0) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && open && matches.length > 0) {
              event.preventDefault();
              pick(matches[0]);
            }
          }}
        />
        <input type="hidden" name="equipmentId" value={selected?.id || ""} />
        <p className="mt-1 text-xs text-slate-500">
          Searches the whole inventory, not a short dropdown list.
          {pending ? " Searching…" : ""}
        </p>
        {lookupError ? (
          <p className="mt-1 text-xs text-rose-700" role="alert">
            {lookupError}
          </p>
        ) : null}
        {selected ? (
          <p className="mt-1 text-xs text-slate-600">
            Selected:{" "}
            <span className="font-medium text-slate-800">
              {selected.controlNum}
            </span>{" "}
            — {detailLine(selected)}
          </p>
        ) : null}
        {open && query.trim() && !pending && matches.length === 0 && !selected ? (
          <p className="mt-1 text-xs text-slate-500">
            No equipment matches {query.trim()}.
          </p>
        ) : null}
        {open && matches.length > 0 ? (
          <ul
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {matches.map((equipment) => (
              <li key={equipment.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
                  onClick={() => pick(equipment)}
                >
                  <span className="font-medium">{equipment.controlNum}</span>
                  <span className="text-slate-500"> — {detailLine(equipment)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import {
  lookupEquipmentByControlNum,
  openCmWorkOrder,
} from "@/lib/actions";

type Tech = { id: string; name: string; techId: string | null; username: string };
type Facility = { id: string; name: string; hospId: string };
type EqMatch = {
  id: string;
  controlNum: string;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  hospId: string | null;
};

function eqLabel(e: EqMatch) {
  const desc =
    e.description || e.model || e.manufacturer || "equipment";
  return `${e.controlNum} — ${desc}`;
}

export function QuickEntryForm({
  facilities,
  techs,
}: {
  facilities: Facility[];
  techs: Tech[];
}) {
  const controlRef = useRef<HTMLInputElement>(null);
  const [controlQuery, setControlQuery] = useState("");
  const [facilityId, setFacilityId] = useState("ALL");
  const [matches, setMatches] = useState<EqMatch[]>([]);
  const [selected, setSelected] = useState<EqMatch | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [lookupPending, startLookup] = useTransition();
  const [submitPending, startSubmit] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [lastWoId, setLastWoId] = useState<string | null>(null);

  useEffect(() => {
    controlRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selected && selected.controlNum === controlQuery.trim()) {
      setMatches([]);
      return;
    }
    const q = controlQuery.trim();
    if (q.length < 1) {
      setMatches([]);
      return;
    }
    const t = setTimeout(() => {
      startLookup(async () => {
        try {
          const rows = await lookupEquipmentByControlNum(q, facilityId);
          setMatches(rows);
          setShowSuggest(true);
        } catch {
          setMatches([]);
        }
      });
    }, 200);
    return () => clearTimeout(t);
  }, [controlQuery, selected, facilityId]);

  function pickEquipment(e: EqMatch) {
    setSelected(e);
    setControlQuery(e.controlNum);
    setShowSuggest(false);
    setMatches([]);
    setMessage(null);
  }

  function onLookupSubmit(e: FormEvent) {
    e.preventDefault();
    const q = controlQuery.trim();
    if (!q) return;
    startLookup(async () => {
      try {
        const rows = await lookupEquipmentByControlNum(q, facilityId);
        const exact =
          rows.find(
            (r) => r.controlNum.toLowerCase() === q.toLowerCase()
          ) || (rows.length === 1 ? rows[0] : null);
        if (exact) {
          pickEquipment(exact);
          setMessage({
            ok: true,
            text: `Found ${exact.controlNum}${exact.location ? ` @ ${exact.location}` : ""}`,
          });
        } else if (rows.length === 0) {
          setSelected(null);
          setMessage({ ok: false, text: `No equipment for Control # ${q}` });
        } else {
          setMatches(rows);
          setShowSuggest(true);
          setMessage({
            ok: false,
            text: "Multiple matches — pick one from the list",
          });
        }
      } catch (err) {
        setMessage({
          ok: false,
          text: err instanceof Error ? err.message : "Lookup failed",
        });
      }
    });
  }

  function onOpen(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setLastWoId(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (selected?.id) fd.set("equipmentId", selected.id);
    fd.set("controlNum", controlQuery.trim());
    fd.set("facility", facilityId);
    startSubmit(async () => {
      try {
        const result = await openCmWorkOrder(fd);
        setMessage({
          ok: true,
          text: `Opened CM WO #${result.woNumber} for ${result.controlNum}`,
        });
        setLastWoId(result.id);
        form.reset();
        setControlQuery("");
        setSelected(null);
        setMatches([]);
        controlRef.current?.focus();
      } catch (err) {
        setMessage({
          ok: false,
          text: err instanceof Error ? err.message : "Could not open work order",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ring-1 ${
            message.ok
              ? "bg-emerald-50 text-emerald-800 ring-emerald-600/15"
              : "bg-rose-50 text-rose-800 ring-rose-600/15"
          }`}
          role="status"
        >
          {message.text}
          {message.ok && lastWoId ? (
            <>
              {" "}
              <Link href={`/cm-work-orders/${lastWoId}`} className="link-brand font-semibold">
                View WO
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={onLookupSubmit} className="card space-y-3">
        <div>
          <label className="label" htmlFor="qe-facility">
            Facility
          </label>
          <select
            id="qe-facility"
            className="input"
            value={facilityId}
            onChange={(event) => {
              setFacilityId(event.target.value);
              setSelected(null);
              setMatches([]);
              setMessage(null);
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
        <div className="relative">
          <label className="label" htmlFor="qe-control">
            Control # *
          </label>
          <div className="flex gap-2">
            <input
              ref={controlRef}
              id="qe-control"
              className="input"
              autoComplete="off"
              value={controlQuery}
              onChange={(ev) => {
                setControlQuery(ev.target.value);
                setSelected(null);
                setMessage(null);
                setShowSuggest(true);
              }}
              onFocus={() => matches.length > 0 && setShowSuggest(true)}
              placeholder="Type Control #…"
              required
            />
            <button
              type="submit"
              className="btn-secondary shrink-0"
              disabled={lookupPending}
            >
              {lookupPending ? "…" : "Lookup"}
            </button>
          </div>
          {showSuggest && matches.length > 0 ? (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
                    onClick={() => pickEquipment(m)}
                  >
                    <span className="font-medium">{m.controlNum}</span>
                    <span className="text-slate-500">
                      {" "}
                      — {m.description || m.model || m.manufacturer || "equipment"}
                      {m.location ? ` · ${m.location}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {selected ? (
          <p className="text-xs text-slate-500">
            Selected: <span className="font-medium text-slate-700">{eqLabel(selected)}</span>
            {selected.location ? ` · ${selected.location}` : ""}
          </p>
        ) : null}
      </form>

      <form onSubmit={onOpen} className="card max-w-2xl space-y-4">
        <input type="hidden" name="equipmentId" value={selected?.id || ""} />
        <div>
          <label className="label" htmlFor="qe-problem">
            Problem / description *
          </label>
          <textarea
            id="qe-problem"
            className="input"
            name="workRequested"
            rows={3}
            required
            placeholder="What needs to be fixed?"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="qe-priority">
              Priority
            </label>
            <select
              id="qe-priority"
              className="input"
              name="priority"
              defaultValue="ROUTINE"
            >
              <option value="STAT">STAT</option>
              <option value="URGENT">Urgent</option>
              <option value="ROUTINE">Routine</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="qe-tech">
              Assigned tech
            </label>
            <select id="qe-tech" className="input" name="assignedTechId" defaultValue="">
              <option value="">—</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.techId || t.username})
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={submitPending || (!selected && !controlQuery.trim())}
        >
          {submitPending ? "Opening…" : "Open WO"}
        </button>
      </form>
    </div>
  );
}

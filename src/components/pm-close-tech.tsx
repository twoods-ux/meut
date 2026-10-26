"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { PM_CLOSE_TECH_REQUIRED } from "@/lib/pm-close";

export type PmCloseTechOption = {
  id: string;
  name: string;
  techId: string | null;
  username: string;
};

const PmCloseTechContext = createContext<{
  techId: string;
  setTechId: (techId: string) => void;
} | null>(null);

export function PmCloseTechState({ children }: { children: ReactNode }) {
  const [techId, setTechId] = useState("");
  return (
    <PmCloseTechContext.Provider value={{ techId, setTechId }}>
      {children}
    </PmCloseTechContext.Provider>
  );
}

function usePmCloseTech() {
  const value = useContext(PmCloseTechContext);
  if (!value) {
    throw new Error("Technician field must be inside the close form");
  }
  return value;
}

export function PmCloseTechSelect({
  techs,
  id,
  className = "input max-w-md",
  compact = false,
}: {
  techs: PmCloseTechOption[];
  id: string;
  className?: string;
  compact?: boolean;
}) {
  const { techId, setTechId } = usePmCloseTech();
  const missing = techId.trim() === "";
  const errorId = `${id}-error`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {compact ? "Tech *" : "Technician who did the work *"}
      </label>
      <select
        id={id}
        name="assignedTechId"
        required
        value={techId}
        onChange={(event) => setTechId(event.target.value)}
        className={className}
        aria-required="true"
        aria-invalid={missing}
        aria-describedby={missing ? errorId : undefined}
        data-pm-close-tech=""
      >
        <option value="">Select technician</option>
        {techs.map((tech) => (
          <option key={tech.id} value={tech.id}>
            {tech.name} ({tech.techId || tech.username})
          </option>
        ))}
      </select>
      {missing ? (
        <p
          id={errorId}
          role={compact ? undefined : "alert"}
          className={
            compact
              ? "mt-1 max-w-[11rem] text-[11px] leading-snug text-red-700"
              : "mt-1 text-sm text-red-800"
          }
        >
          {PM_CLOSE_TECH_REQUIRED}
        </p>
      ) : null}
    </div>
  );
}

export function PmCloseSubmit({
  className,
  children,
  formAction,
  pending = false,
  pendingLabel = "Closing…",
}: {
  className?: string;
  children: ReactNode;
  formAction?: (formData: FormData) => void | Promise<void>;
  pending?: boolean;
  pendingLabel?: string;
}) {
  const { techId } = usePmCloseTech();
  const blocked = techId.trim() === "";
  const disabled = blocked || pending;
  const blockedClass = blocked
    ? "cursor-not-allowed !bg-none !bg-slate-200 !text-slate-500 !shadow-none"
    : "";
  return (
    <button
      type="submit"
      formAction={formAction}
      className={[className, blockedClass].filter(Boolean).join(" ")}
      disabled={disabled}
      aria-disabled={disabled}
      title={blocked ? PM_CLOSE_TECH_REQUIRED : undefined}
      data-pm-close-submit=""
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

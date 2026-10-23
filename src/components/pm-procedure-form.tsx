"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { savePmProcedureTemplate } from "@/lib/pm-procedure-actions";

type StepType = "PASS_FAIL" | "NUMERIC" | "NOTE";

type DraftStep = {
  key: string;
  text: string;
  stepType: StepType;
  required: boolean;
  unit: string;
  minValue: string;
  maxValue: string;
};

function blankStep(): DraftStep {
  return {
    key: Math.random().toString(36).slice(2),
    text: "",
    stepType: "PASS_FAIL",
    required: true,
    unit: "",
    minValue: "",
    maxValue: "",
  };
}

export function PmProcedureForm({
  templateId,
  initial,
}: {
  templateId: string | null;
  initial?: {
    name: string;
    deviceType: string;
    aliases: string;
    manufacturer: string;
    model: string;
    notes: string;
    active: boolean;
    steps: Array<{
      text: string;
      stepType: string;
      required: boolean;
      unit: string | null;
      minValue: number | null;
      maxValue: number | null;
    }>;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [steps, setSteps] = useState<DraftStep[]>(() => {
    if (!initial || initial.steps.length === 0) return [blankStep()];
    return initial.steps.map((step) => ({
      key: Math.random().toString(36).slice(2),
      text: step.text,
      stepType:
        step.stepType === "NUMERIC" || step.stepType === "NOTE"
          ? step.stepType
          : "PASS_FAIL",
      required: step.required,
      unit: step.unit || "",
      minValue: step.minValue == null ? "" : String(step.minValue),
      maxValue: step.maxValue == null ? "" : String(step.maxValue),
    }));
  });

  function updateStep(key: string, patch: Partial<DraftStep>) {
    setSteps((current) =>
      current.map((step) => (step.key === key ? { ...step, ...patch } : step))
    );
  }

  function move(key: string, direction: -1 | 1) {
    setSteps((current) => {
      const index = current.findIndex((step) => step.key === key);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.length) return current;
      const copy = [...current];
      const [row] = copy.splice(index, 1);
      copy.splice(next, 0, row);
      return copy;
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set(
      "stepsJson",
      JSON.stringify(
        steps.map((step) => ({
          text: step.text,
          stepType: step.stepType,
          required: step.required,
          unit: step.unit,
          minValue: step.minValue,
          maxValue: step.maxValue,
        }))
      )
    );
    setError(null);
    startTransition(async () => {
      const result = await savePmProcedureTemplate(templateId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/pm-procedures/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label" htmlFor="pm-name">
            Name *
          </label>
          <input
            id="pm-name"
            className="input"
            name="name"
            required
            defaultValue={initial?.name || ""}
            placeholder="Infusion pump"
          />
        </div>
        <div>
          <label className="label" htmlFor="pm-type">
            Device type
          </label>
          <input
            id="pm-type"
            className="input"
            name="deviceType"
            defaultValue={initial?.deviceType || ""}
            placeholder="Infusion pump"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Matched against the equipment description. Leave blank to ignore type.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="pm-aliases">
            Type aliases
          </label>
          <input
            id="pm-aliases"
            className="input"
            name="aliases"
            defaultValue={initial?.aliases || ""}
            placeholder="IV pump, syringe pump"
          />
        </div>
        <div>
          <label className="label" htmlFor="pm-mfr">
            Manufacturer
          </label>
          <input
            id="pm-mfr"
            className="input"
            name="manufacturer"
            defaultValue={initial?.manufacturer || ""}
            placeholder="Any manufacturer"
          />
        </div>
        <div>
          <label className="label" htmlFor="pm-model">
            Model
          </label>
          <input
            id="pm-model"
            className="input"
            name="model"
            defaultValue={initial?.model || ""}
            placeholder="Any model"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            A model match wins over manufacturer + type, which wins over type alone.
          </p>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="pm-notes">
            Notes
          </label>
          <textarea
            id="pm-notes"
            className="input"
            name="notes"
            rows={3}
            defaultValue={initial?.notes || ""}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="active"
            value="true"
            defaultChecked={initial?.active ?? true}
          />
          Active (inactive templates are not used for new work orders)
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Steps</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setSteps((current) => [...current, blankStep()])}
          >
            Add step
          </button>
        </div>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.key}
              className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="w-8 text-xs font-semibold tabular-nums text-slate-400">
                  {index + 1}
                </span>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs"
                  onClick={() => move(step.key, -1)}
                  disabled={index === 0}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs"
                  onClick={() => move(step.key, 1)}
                  disabled={index === steps.length - 1}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs text-rose-700"
                  onClick={() =>
                    setSteps((current) =>
                      current.length === 1
                        ? current
                        : current.filter((row) => row.key !== step.key)
                    )
                  }
                >
                  Remove
                </button>
              </div>
              <textarea
                className="input"
                rows={2}
                value={step.text}
                onChange={(event) => updateStep(step.key, { text: event.target.value })}
                placeholder="What should the technician check?"
                aria-label={`Step ${index + 1} text`}
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs text-slate-500">
                  Type
                  <select
                    className="input mt-1"
                    value={step.stepType}
                    onChange={(event) =>
                      updateStep(step.key, {
                        stepType: event.target.value as StepType,
                      })
                    }
                  >
                    <option value="PASS_FAIL">Pass / fail</option>
                    <option value="NUMERIC">Numeric reading</option>
                    <option value="NOTE">Note / text</option>
                  </select>
                </label>
                <label className="mt-5 flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={step.required}
                    onChange={(event) =>
                      updateStep(step.key, { required: event.target.checked })
                    }
                  />
                  Required
                </label>
                {step.stepType === "NUMERIC" ? (
                  <>
                    <label className="text-xs text-slate-500">
                      Units
                      <input
                        className="input mt-1"
                        value={step.unit}
                        onChange={(event) =>
                          updateStep(step.key, { unit: event.target.value })
                        }
                        placeholder="Ω, µA, mmHg"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-slate-500">
                        Min
                        <input
                          className="input mt-1"
                          inputMode="decimal"
                          value={step.minValue}
                          onChange={(event) =>
                            updateStep(step.key, { minValue: event.target.value })
                          }
                        />
                      </label>
                      <label className="text-xs text-slate-500">
                        Max
                        <input
                          className="input mt-1"
                          inputMode="decimal"
                          value={step.maxValue}
                          onChange={(event) =>
                            updateStep(step.key, { maxValue: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save procedure"}
        </button>
      </div>
    </form>
  );
}

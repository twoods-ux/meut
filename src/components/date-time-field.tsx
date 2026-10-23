export function DateTimeField({
  name,
  label,
  id,
  defaultValue,
  required = true,
  hint,
}: {
  name: string;
  label: string;
  id: string;
  defaultValue: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input max-w-xs"
        type="datetime-local"
        name={name}
        required={required}
        step={60}
        defaultValue={defaultValue}
      />
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

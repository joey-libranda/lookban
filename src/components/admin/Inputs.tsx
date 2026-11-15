// Plain (uncontrolled) inputs for server-action forms. Values come from FormData on the server.
import { Select as UiSelect } from "@/components/ui/Select";
type Common = { name: string; label: string; error?: string; hint?: string };

export function TextInput({ name, label, error, hint, ...rest }: Common & React.ComponentProps<"input">) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} className="input" aria-invalid={!!error} {...rest} />
      {hint && !error && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {error && <p role="alert" className="field-error">{error}</p>}
    </div>
  );
}

export function TextArea({ name, label, error, hint, ...rest }: Common & React.ComponentProps<"textarea">) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <textarea id={name} name={name} rows={3} className="input" aria-invalid={!!error} {...rest} />
      {hint && !error && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {error && <p role="alert" className="field-error">{error}</p>}
    </div>
  );
}

export function Select({ name, label, error, children, defaultValue, required }: Common & Pick<React.ComponentProps<"select">, "defaultValue" | "required" | "children">) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <UiSelect id={name} name={name} defaultValue={defaultValue as string | undefined} required={required} aria-invalid={!!error}>{children}</UiSelect>
      {error && <p role="alert" className="field-error">{error}</p>}
    </div>
  );
}

export function Check({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-[var(--lb-orange)]" />
      <span><span className="font-semibold text-ink">{label}</span>{hint && <span className="block text-muted">{hint}</span>}</span>
    </label>
  );
}

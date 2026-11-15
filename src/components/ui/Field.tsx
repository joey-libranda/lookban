"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { FieldError } from "react-hook-form";

type Props = React.ComponentProps<"input"> & {
  label: string;
  error?: FieldError;
  hint?: string;
};

/** Labelled input with accessible error text. Works with react-hook-form's register(). */
export function Field({ label, error, hint, id, ref, type, ...rest }: Props) {
  const fieldId = id ?? rest.name;
  const isPassword = type === "password";
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={fieldId} className="label">{label}</label>
      <div className="relative">
        <input
          id={fieldId}
          ref={ref}
          type={isPassword && shown ? "text" : type}
          className={isPassword ? "input !pr-11" : "input"}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined}
          {...rest}
        />
        {isPassword && (
          <button type="button" onClick={() => setShown((v) => !v)} aria-pressed={shown}
            aria-label={shown ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink">
            {shown ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        )}
      </div>
      {hint && !error && <p id={`${fieldId}-hint`} className="mt-1 text-sm text-muted">{hint}</p>}
      {error && <p id={`${fieldId}-err`} role="alert" className="field-error">{error.message}</p>}
    </div>
  );
}

export function FormNotice({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  const styles = kind === "error"
    ? "border-red-200 bg-red-50 text-red-800"
    : "border-green-200 bg-green-50 text-green-900";
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-lg border px-3.5 py-2.5 text-sm ${styles}`}>
      {children}
    </p>
  );
}

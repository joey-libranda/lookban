"use client";

import { Minus, Plus } from "lucide-react";

/** Round − 1 + quantity control. */
export function Stepper({ value, min = 1, max, onChange, label = "Quantity" }: {
  value: number; min?: number; max: number; onChange: (n: number) => void; label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-2.5">
      <button type="button" aria-label="Decrease quantity" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}
              className="flex size-8 items-center justify-center rounded-full bg-line/70 text-ink transition hover:scale-110 hover:bg-line disabled:opacity-40 disabled:hover:scale-100">
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="min-w-5 text-center font-semibold" aria-live="polite">{value}</span>
      <button type="button" aria-label="Increase quantity" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}
              className="flex size-8 items-center justify-center rounded-full bg-line/70 text-ink transition hover:scale-110 hover:bg-line disabled:opacity-40 disabled:hover:scale-100">
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

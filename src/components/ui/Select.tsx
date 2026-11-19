"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type Opt = { value: string; label: string; disabled: boolean };

type Props = {
  id?: string; name?: string; children: React.ReactNode;
  defaultValue?: string | number | null; value?: string | number;
  onChange?: (value: string) => void; disabled?: boolean; className?: string; compact?: boolean;
  "aria-label"?: string; "aria-invalid"?: boolean; required?: boolean;
};

/** <option> children -> plain data (so call sites keep writing normal <option> tags). */
function readOptions(children: React.ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c) || c.type !== "option") return;
    const p = c.props as { value?: string | number; disabled?: boolean; children?: React.ReactNode };
    const label = Children.toArray(p.children).join("");
    out.push({ value: String(p.value ?? label), label, disabled: !!p.disabled });
  });
  return out;
}

/**
 * Dropdown that replaces the browser's <select>, so the list matches the site (rounded card, same width as its field).
 * Works inside plain <form>s (a hidden input carries the value) and with keyboard: arrows, Enter, Escape.
 */
export function Select({ id, name, children, defaultValue, value, onChange, disabled, className = "", compact, ...aria }: Props) {
  const opts = readOptions(children);
  const [inner, setInner] = useState(String(defaultValue ?? ""));
  const cur = value !== undefined ? String(value) : inner;
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = opts.find((o) => o.value === cur) ?? opts[0];
  const placeholder = !selected || (selected.disabled && selected.value === "");

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  function choose(o: Opt) {
    if (o.disabled) return;
    setInner(o.value); onChange?.(o.value); setOpen(false);
  }
  function openList() {
    setHi(Math.max(0, opts.findIndex((o) => o.value === cur)));
    setOpen(true);
  }
  function step(dir: 1 | -1) {
    let n = hi;
    for (let k = 0; k < opts.length; k++) { n = (n + dir + opts.length) % opts.length; if (!opts[n].disabled) break; }
    setHi(n);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!open) openList(); else step(e.key === "ArrowDown" ? 1 : -1); return; }
    if ((e.key === "Enter" || e.key === " ") && open) { e.preventDefault(); if (opts[hi]) choose(opts[hi]); }
    else if ((e.key === "Enter" || e.key === " ") && !open) { e.preventDefault(); openList(); }
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={cur} />}
      <button type="button" id={id} disabled={disabled} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
              aria-label={aria["aria-label"]} aria-invalid={aria["aria-invalid"]}
              onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKey}
              className={`input flex items-center justify-between gap-2 text-left disabled:opacity-60 ${compact ? "!py-1.5 text-sm" : ""} ${placeholder ? "text-muted/80" : ""}`}>
        <span className="truncate">{selected?.label ?? ""}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul id={listId} role="listbox" className={`card absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto p-1.5 shadow-lg ${compact ? "text-sm" : ""}`}>
          {opts.map((o, n) => (
            <li key={o.value + n} role="option" aria-selected={o.value === cur} aria-disabled={o.disabled}
                onMouseEnter={() => !o.disabled && setHi(n)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 ${compact ? "py-1.5" : "py-2"} text-sm
                  ${o.disabled ? "cursor-default text-muted/70" : n === hi ? "bg-blue-50" : ""} ${o.value === cur && !o.disabled ? "font-semibold text-brand" : ""}`}>
              <span className="truncate">{o.label}</span>
              {o.value === cur && !o.disabled && <Check className="size-4 shrink-0" aria-hidden />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { NavLinks } from "@/components/layout/NavLinks";

/** Hamburger menu for small screens; closes after a choice, on outside click and on Escape. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={box} className="relative lg:hidden">
      <button type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded-lg p-2.5 text-blue hover:bg-blue-50">
        <Menu className="size-6" aria-hidden />
      </button>
      {open && <div className="card absolute right-0 z-50 mt-2 w-56 p-1.5 shadow-lg" onClick={() => setOpen(false)}><NavLinks variant="menu" /></div>}
    </div>
  );
}

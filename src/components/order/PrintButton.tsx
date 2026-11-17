"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print Receipt" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary no-print">
      <Printer className="size-4" aria-hidden /> {label}
    </button>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/server/actions/admin";

/** A button that asks for confirmation, runs a server action, and shows its error (if any) inline. */
export function ConfirmButton({ action, confirm, children, className = "btn-outline" }: {
  action: () => Promise<FormState | void>; confirm: string; children: React.ReactNode; className?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={className} disabled={pending}
        onClick={() => { if (!window.confirm(confirm)) return; start(async () => {
          const r = await action();
          if (r) setMsg({ ok: r.ok, text: (r.ok ? r.message : r.error) ?? "" });
        }); }}>
        {pending ? "Working…" : children}
      </button>
      {msg && <span role={msg.ok ? "status" : "alert"} className={`max-w-xs text-sm ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.text}</span>}
    </span>
  );
}

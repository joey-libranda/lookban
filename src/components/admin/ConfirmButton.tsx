"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import type { FormState } from "@/server/actions/admin";

/** A button that asks for confirmation, runs a server action, and shows the result as a toast. */
export function ConfirmButton({ action, confirm, children, className = "btn-outline" }: {
  action: () => Promise<FormState | void>; confirm: string; children: React.ReactNode; className?: string;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={className} disabled={pending}
        onClick={() => { if (!window.confirm(confirm)) return; start(async () => {
          const r = await action();
          if (r) toast(r.ok ? "success" : "error", (r.ok ? r.message : r.error) ?? "");
        }); }}>
        {pending ? "Working…" : children}
      </button>
    </span>
  );
}

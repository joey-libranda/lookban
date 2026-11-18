"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import type { FormState } from "@/server/actions/admin";

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: (errors: Record<string, string>) => React.ReactNode;
  submitLabel: string;
  className?: string;
};

/**
 * Wraps a server action: shows success/error toasts and per-field messages returned by Zod validation.
 * Submits with onSubmit (not <form action>) on purpose: React resets uncontrolled inputs after a form action,
 * which would wipe what the person typed when validation fails.
 */
export function ActionForm({ action, children, submitLabel, className }: Props) {
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  return (
    <form
      className={className ?? "space-y-5"}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            const res = await action(null, fd);
            setState(res);
            // Process messages are toasts; field-level problems stay next to their field.
            if (res?.ok && res.message) toast("success", res.message);
            else if (res && !res.ok && res.error) toast("error", res.error);
          } catch {
            setState(null);
            toast("error", "Couldn't reach the server. Check your connection and try again.");
          }
        });
      }}
    >
      {children(state?.fieldErrors ?? {})}
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}

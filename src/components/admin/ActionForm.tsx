"use client";

import { useState, useTransition } from "react";
import { FormNotice } from "@/components/ui/Field";
import type { FormState } from "@/server/actions/admin";

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: (errors: Record<string, string>) => React.ReactNode;
  submitLabel: string;
  className?: string;
};

/**
 * Wraps a server action: shows success/error notices and per-field messages returned by Zod validation.
 * Submits with onSubmit (not <form action>) on purpose: React resets uncontrolled inputs after a form action,
 * which would wipe what the person typed when validation fails.
 */
export function ActionForm({ action, children, submitLabel, className }: Props) {
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className={className ?? "space-y-5"}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            setState(await action(null, fd));
          } catch {
            setState({ ok: false, error: "Couldn't reach the server. Check your connection and try again." });
          }
        });
      }}
    >
      {children(state?.fieldErrors ?? {})}
      {state?.error && <FormNotice kind="error">{state.error}</FormNotice>}
      {state?.ok && state.message && <FormNotice kind="success">{state.message}</FormNotice>}
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}

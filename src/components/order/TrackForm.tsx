"use client";

import { useState, useTransition } from "react";
import { FormNotice } from "@/components/ui/Field";
import { TextInput } from "@/components/admin/Inputs";
import { trackOrderAction } from "@/server/actions/guest";

export function TrackForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-4" noValidate onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      setError(null);
      start(async () => {
        try { const r = await trackOrderAction(null, fd); if (r?.error) setError(r.error); } // success redirects
        catch { setError("Couldn't reach the server. Check your connection and try again."); }
      });
    }}>
      <TextInput name="receipt" label="Receipt number" placeholder="LB-20261113-00001" autoComplete="off" required />
      <TextInput name="phone" label="Mobile number used at checkout" type="tel" placeholder="09171234567" autoComplete="tel" required />
      {error && <FormNotice kind="error">{error}</FormNotice>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Looking…" : "Track my order"}</button>
    </form>
  );
}

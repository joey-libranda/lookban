"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/actions/auth";

/** Shared submit plumbing for the auth forms: pending state + server error/success message. */
export function useAuthSubmit() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function submit(run: () => Promise<ActionResult | void>) {
    setResult(null);
    start(async () => {
      // On success the action calls redirect(), which navigates and never returns here.
      const r = await run();
      if (r) setResult(r);
    });
  }
  return { pending, result, submit };
}

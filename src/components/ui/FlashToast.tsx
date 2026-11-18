"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/Toast";

/** Shows a toast once when a page loads (e.g. after "created" or "deleted" redirects). */
export function FlashToast({ kind = "success", text }: { kind?: "success" | "error"; text: string }) {
  const toast = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return; shown.current = true; // StrictMode runs effects twice in dev
    toast(kind, text);
  }, [toast, kind, text]);
  return null;
}

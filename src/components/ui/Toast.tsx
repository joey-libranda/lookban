"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

type Toast = { id: number; kind: "success" | "error"; text: string };
const Ctx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});

/** `const toast = useToast(); toast("success", "Added to cart")` - small pop-up that closes itself. */
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback((kind: Toast["kind"], text: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]); // at most 3 on screen
    setTimeout(() => dismiss(id), kind === "error" ? 5000 : 3000);
  }, [dismiss]);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg
            ${t.kind === "success" ? "bg-blue text-white" : "bg-danger text-white"}`}>
            {t.kind === "success" ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : <XCircle className="size-5 shrink-0" aria-hidden />}
            <span>{t.text}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="pop ml-1 rounded p-0.5 hover:bg-white/20"><X className="size-4" aria-hidden /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

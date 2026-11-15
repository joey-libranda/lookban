"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";

/**
 * Lets the filter bar and the product results (both rendered by the page) share one "refreshing" state.
 * While a filter change loads, the old products stay on screen, dimmed - only that part of the page updates.
 */
const Ctx = createContext<{ pending: boolean; run: (fn: () => void) => void }>({ pending: false, run: (fn) => fn() });

export function ShopTransition({ children }: { children: ReactNode }) {
  const [pending, start] = useTransition();
  return <Ctx.Provider value={{ pending, run: (fn) => start(fn) }}>{children}</Ctx.Provider>;
}

export const useShopTransition = () => useContext(Ctx);

/** Wraps the results (count, grid, pagination). */
export function PendingRegion({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { pending } = useShopTransition();
  return (
    <div aria-busy={pending} className={`${className} transition-opacity duration-200 ${pending ? "pointer-events-none opacity-50" : ""}`}>
      {children}
    </div>
  );
}

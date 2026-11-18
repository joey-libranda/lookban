"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { clearGuestCart, readGuestCart } from "@/lib/guest-cart";
import { mergeGuestCartAction } from "@/server/actions/guest";

/** isAdmin = any staff account (admin or vendor): they manage the marketplace and do not shop. */
type Shopper = { loggedIn: boolean; isAdmin: boolean; role?: "customer" | "vendor" | "admin" };
const Ctx = createContext<Shopper>({ loggedIn: false, isAdmin: false });
export const useShopper = () => useContext(Ctx);

/**
 * Tells client components who is browsing (visitor / customer / admin) and, right after someone logs in,
 * moves the cart they built as a visitor into their saved cart.
 */
export function ShopperProvider({ loggedIn, isAdmin, role, children }: Shopper & { children: React.ReactNode }) {
  const router = useRouter();
  const merging = useRef(false);

  useEffect(() => {
    if (!loggedIn || merging.current) return;
    const items = readGuestCart();
    if (items.length === 0) return;
    merging.current = true;
    if (isAdmin) { clearGuestCart(); return; } // staff accounts don't shop; drop the leftover visitor cart
    mergeGuestCartAction(items)
      .then((r) => { if (r.failed === 0) clearGuestCart(); else merging.current = false; router.refresh(); })
      .catch(() => { merging.current = false; }) // keep the items; try again on the next page load
  }, [loggedIn, isAdmin, router]);

  return <Ctx.Provider value={{ loggedIn, isAdmin, role }}>{children}</Ctx.Provider>;
}

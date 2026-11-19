"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ShoppingCart } from "lucide-react";
import { guestCount, onGuestCartChange, readGuestCart } from "@/lib/guest-cart";
import { useShopper } from "./ShopperProvider";

/** Header cart icon + count. Customers: saved cart (server count). Visitors: this tab's cart. Admins: none. */
export function CartLink({ serverCount }: { serverCount: number }) {
  const { loggedIn, isAdmin } = useShopper();
  const guest = useSyncExternalStore(onGuestCartChange, () => guestCount(readGuestCart()), () => 0);
  if (isAdmin) return null; // staff (admin, vendor) have no cart
  const count = loggedIn ? serverCount : guest;
  return (
    <Link href="/cart" aria-label={`Shopping cart${count ? `, ${count} items` : ""}`} className="relative rounded-lg p-2.5 text-brand hover:bg-blue-50">
      <ShoppingCart className="size-6" aria-hidden />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-orange px-1 text-[11px] font-bold leading-5 text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

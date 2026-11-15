"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShoppingCart } from "lucide-react";
import { maxQuantity } from "@/lib/utils/cart";
import { addToCartAction } from "@/server/actions/cart";
import { guestAddCheckAction } from "@/server/actions/guest";
import { readGuestCart, writeGuestCart } from "@/lib/guest-cart";
import { useShopper } from "@/components/shop/ShopperProvider";
import { useToast } from "@/components/ui/Toast";
import { Stepper } from "./Stepper";

type Props = {
  productId: string;
  stock: number;
  disabled?: boolean;
  /** Smaller button (cards). */
  compact?: boolean;
  /** Where the quantity stepper goes: "above" the button (product page), "slot" = returned to the parent (cards). */
  withQuantity?: boolean;
  /** Card layout: render the stepper on the right of this element's row (see ProductCard). */
  priceSlot?: React.ReactNode | ((qty: number) => React.ReactNode);
};

/**
 * Logged-in customers: adds to their saved (database) cart.
 * Visitors: adds to a browser-only cart that vanishes when the tab closes (checked against stock by the server).
 * Admins: no cart - they get a link to edit the product instead.
 * Either way the server decides price/stock; this component only says WHICH product and HOW MANY.
 * Feedback is a toast, not text inside the card.
 */
export function AddToCartButton({ productId, stock, disabled, compact, withQuantity, priceSlot }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [qty, setQty] = useState(1);
  const max = maxQuantity(stock);
  const { loggedIn, isAdmin } = useShopper();
  // The price can follow the quantity: pass a function and it gets the chosen quantity.
  const slot = typeof priceSlot === "function" ? priceSlot(qty) : priceSlot;

  if (isAdmin) {
    return (
      <>
        {slot && <div className="flex items-center justify-between pt-2">{slot}</div>}
        <Link href={`/admin/products/${productId}`} className={`btn-outline w-full ${compact ? "!py-2 text-sm" : ""}`}>Edit in Admin</Link>
      </>
    );
  }

  function add() {
    start(async () => {
      try {
        if (!loggedIn) {
          const items = readGuestCart();
          const have = items.find((i) => i.p === productId)?.q ?? 0;
          const r = await guestAddCheckAction(productId, qty, have);
          if (!r.ok) { toast("error", r.error); return; }
          writeGuestCart(have ? items.map((i) => (i.p === productId ? { ...i, q: r.quantity } : i)) : [...items, { p: productId, q: r.quantity }].slice(0, 50));
          toast("success", r.capped ? `Only ${r.quantity} available - cart updated` : `${r.name} added to cart`);
          return;
        }
        const r = await addToCartAction(productId, qty);
        if (!r.ok && r.needsLogin) { router.push(`/login?next=${encodeURIComponent(pathname)}`); return; }
        if (r.ok) { toast("success", r.message); router.refresh(); } // refresh updates the header cart count
        else toast("error", r.error);
      } catch {
        toast("error", "Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  const stepper = withQuantity && !disabled ? <Stepper value={qty} max={max} onChange={setQty} /> : null;
  return (
    <div>
      {slot ? (
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-2 gap-y-1 pb-0 pt-0 mb-2 mt-1">{slot}{stepper}</div>
      ) : stepper && (
        <div className="mb-3 flex items-center gap-3">
          <span className="text-sm font-semibold">Quantity</span>{stepper}
        </div>
      )}
      <button type="button" onClick={add} disabled={disabled || pending}
              className={`btn-primary w-full ${compact ? "!py-2 text-sm" : ""}`}>
        <ShoppingCart className="size-4" aria-hidden /> {pending ? "Adding…" : "Add to Cart"}
      </button>
    </div>
  );
}

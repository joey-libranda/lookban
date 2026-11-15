"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { formatPeso } from "@/lib/utils/format";
import { readGuestCart, type GuestItem } from "@/lib/guest-cart";
import { guestCartAction, type GuestCartData } from "@/server/actions/guest";

/** Checkout for visitors without an account. Totals shown here are re-computed by the database on submit. */
export function GuestCheckout() {
  const router = useRouter();
  const [items, setItems] = useState<GuestItem[] | null>(null);
  const [cart, setCart] = useState<GuestCartData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // sessionStorage only exists in the browser, so the cart is read after mount.
    const list = readGuestCart();
    if (list.length === 0) { router.replace("/cart"); return; }
    guestCartAction(list).then((r) => {
      setItems(list);
      if (!r.ok) setError(r.error);
      else if (r.cart.lines.length === 0 || r.cart.hasIssues) router.replace("/cart"); // fix problems in the cart first
      else setCart(r.cart);
    }).catch(() => setError("Could not load your cart. Please try again."));
  }, [router]);

  if (error) return <div className="mx-auto max-w-lg px-4 py-24 text-center"><p role="alert" className="text-red-800">{error}</p><Link href="/cart" className="btn-primary mt-6">Back to Cart</Link></div>;
  if (!items || !cart) return <div role="status" aria-label="Loading checkout" className="mx-auto mt-10 h-64 max-w-7xl animate-pulse rounded-xl bg-line" />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl">Checkout</h1>
      <p className="mt-2 rounded-lg bg-yellow/60 p-3 text-sm">
        Checking out as a guest. <Link href="/login?next=/checkout" className="font-semibold pop hover:opacity-70">Log in</Link> or <Link href="/register?next=/checkout" className="font-semibold pop hover:opacity-70">register</Link>{" "}
        instead to have your details filled in and your orders saved. After you order you&apos;ll get a tracking link - keep your receipt number.
      </p>
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_24rem]">
        <CheckoutForm defaults={{}} guest={{ items }} />
        <div className="space-y-4">
          <OrderSummary cart={cart} />
          {cart.groups.map((g) => (
            <section key={g.storeId} className="card p-4 text-sm" aria-label={`Items from ${g.storeName}`}>
              <h3 className="!font-sans text-base font-bold text-blue">{g.storeName}</h3>
              <ul className="mt-2 space-y-1.5">
                {g.lines.map((l) => (
                  <li key={l.itemId} className="flex justify-between gap-3">
                    <span>{l.quantity} × {l.product!.name}{l.product!.variant_label ? ` (${l.product!.variant_label})` : ""}</span>
                    <span className="shrink-0">{formatPeso(l.product!.price * l.quantity)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex justify-between border-t border-line pt-2 text-muted"><span>Shipping</span><span>{formatPeso(g.shippingFee)}</span></p>
            </section>
          ))}
          <p className="text-center text-sm"><Link href="/cart" className="font-semibold text-blue pop hover:text-orange">Edit cart</Link></p>
        </div>
      </div>
    </div>
  );
}

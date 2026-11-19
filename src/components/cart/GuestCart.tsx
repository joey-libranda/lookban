"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CartLineRow } from "@/components/cart/CartLineRow";
import { EmptyCartButton } from "@/components/cart/EmptyCartButton";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { formatPeso } from "@/lib/utils/format";
import { clearGuestCart, readGuestCart, writeGuestCart, type GuestItem } from "@/lib/guest-cart";
import { maxQuantity } from "@/lib/utils/cart";
import { guestCartAction, type GuestCartData } from "@/server/actions/guest";

/**
 * Cart for visitors. Held in this tab only (gone when it closes). Prices and stock are fetched from the server,
 * so the totals shown are real even though nothing is saved to an account.
 */
export function GuestCart() {
  const [items, setItems] = useState<GuestItem[] | null>(null);
  const [cart, setCart] = useState<GuestCartData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (list: GuestItem[]) => {
    await null; // always asynchronous, so it is safe to call from an effect
    if (list.length === 0) { setCart(null); return; }
    const r = await guestCartAction(list);
    if (r.ok) { setCart(r.cart); setError(null); } else setError(r.error);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await null; // sessionStorage only exists in the browser, so the cart is read after mount
      const list = readGuestCart();
      if (!alive) return;
      setItems(list);
      try { await load(list); } catch { if (alive) setError("Could not load your cart. Please try again."); }
    })();
    return () => { alive = false; };
  }, [load]);

  function save(next: GuestItem[]) {
    setItems(next); writeGuestCart(next);
    load(next).catch(() => setError("Could not refresh your totals. Check your connection."));
  }

  if (items === null) return <div role="status" aria-label="Loading cart" className="mx-auto h-64 max-w-7xl animate-pulse rounded-xl bg-line" />;

  if (items.length === 0 || (cart && cart.lines.length === 0)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-4xl">Your cart is empty</h1>
        <p className="mt-3 text-muted">Find something from Lucban&apos;s local stores.</p>
        <Link href="/shop" className="btn-primary mt-6">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl">Your cart</h1>
      <p className="mt-1 text-muted">Items are grouped by store. Each store prepares and ships its own part of your order.</p>
      <p className="mt-4 rounded-lg bg-sun/60 p-3 text-sm">
        You&apos;re shopping without an account, so this cart is <strong>only kept until you close this tab</strong>.{" "}
        <Link href="/login?next=/cart" className="font-semibold pop hover:opacity-70">Log in</Link> or <Link href="/register?next=/cart" className="font-semibold pop hover:opacity-70">register</Link> to save it,
        fill in your details faster and keep your order history.
      </p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {!cart ? <div role="status" aria-label="Loading totals" className="mt-8 h-64 animate-pulse rounded-xl bg-line" /> : (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            {cart.groups.map((g) => (
              <section key={g.storeId} className="card p-5" aria-labelledby={`store-${g.storeId}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
                  <h2 id={`store-${g.storeId}`} className="text-xl"><Link href={`/stores/${g.storeSlug}`} className="pop hover:text-orange">{g.storeName}</Link></h2>
                  <p className="text-sm text-muted">Shipping from this store: {formatPeso(g.shippingFee)}</p>
                </div>
                <ul className="divide-y divide-line">
                  {g.lines.map((l) => (
                    <CartLineRow key={l.itemId} line={l} local={{
                      setQty: (q) => save(items.map((i) => (i.p === l.itemId ? { ...i, q: Math.max(1, Math.min(q, l.product ? maxQuantity(l.product.stock) || 1 : q)) } : i))),
                      remove: () => save(items.filter((i) => i.p !== l.itemId)),
                    }} />
                  ))}
                </ul>
                <p className="border-t border-line pt-3 text-right text-sm">Store subtotal <span className="font-bold text-brand">{formatPeso(g.subtotal)}</span></p>
              </section>
            ))}
            {cart.unavailable.length > 0 && (
              <section className="card border-red-200 p-5" aria-label="Unavailable items">
                <h2 className="text-xl text-red-800">No longer available</h2>
                <ul className="divide-y divide-line">
                  {cart.unavailable.map((l) => <CartLineRow key={l.itemId} line={l} local={{ setQty: () => {}, remove: () => save(items.filter((i) => i.p !== l.itemId)) }} />)}
                </ul>
              </section>
            )}
          </div>
          <OrderSummary cart={cart}>
            {cart.hasIssues && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Some items need attention. Fix or remove them to continue.</p>}
            {cart.hasIssues
              ? <button disabled className="btn-primary mt-5 w-full">Check Out</button>
              : <Link href="/checkout" className="btn-primary mt-5 w-full">Check Out</Link>}
            <Link href="/shop" className="btn-outline mt-3 w-full">Continue Shopping</Link>
            <EmptyCartButton onEmpty={() => { clearGuestCart(); setItems([]); setCart(null); }} />
          </OrderSummary>
        </div>
      )}
    </div>
  );
}

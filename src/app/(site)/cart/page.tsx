import type { Metadata } from "next";
import Link from "next/link";
import { ServerEmptyCart } from "@/components/cart/ServerEmptyCart";
import { CartLineRow } from "@/components/cart/CartLineRow";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { redirect } from "next/navigation";
import { GuestCart } from "@/components/cart/GuestCart";
import { getCurrentUser } from "@/lib/auth/guards";
import { formatPeso } from "@/lib/utils/format";
import { getCart } from "@/server/queries/cart";

export const metadata: Metadata = { title: "Your cart" };

export default async function CartPage() {
  const current = await getCurrentUser();
  if (current?.profile.role === "admin") redirect("/admin"); // admins have no cart
  if (current?.profile.role === "vendor") redirect("/vendor");
  if (!current) return <GuestCart />; // visitors: browser-held cart, no login needed
  const cart = await getCart();

  if (cart.lines.length === 0) {
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

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {cart.groups.map((g) => (
            <section key={g.storeId} className="card p-5" aria-labelledby={`store-${g.storeId}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
                <h2 id={`store-${g.storeId}`} className="text-xl">
                  <Link href={`/stores/${g.storeSlug}`} className="pop hover:text-orange">{g.storeName}</Link>
                </h2>
                <p className="text-sm text-muted">Shipping from this store: {formatPeso(g.shippingFee)}</p>
              </div>
              <ul className="divide-y divide-line">{g.lines.map((l) => <CartLineRow key={l.itemId} line={l} />)}</ul>
              <p className="border-t border-line pt-3 text-right text-sm">
                Store subtotal <span className="font-bold text-blue">{formatPeso(g.subtotal)}</span>
              </p>
            </section>
          ))}

          {cart.unavailable.length > 0 && (
            <section className="card border-red-200 p-5" aria-label="Unavailable items">
              <h2 className="text-xl text-red-800">No longer available</h2>
              <ul className="divide-y divide-line">{cart.unavailable.map((l) => <CartLineRow key={l.itemId} line={l} />)}</ul>
            </section>
          )}
        </div>

        <OrderSummary cart={cart}>
          {cart.hasIssues && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              Some items need attention. Fix or remove them to continue.
            </p>
          )}
          {cart.hasIssues
            ? <button disabled className="btn-primary mt-5 w-full">Check Out</button>
            : <Link href="/checkout" className="btn-primary mt-5 w-full">Check Out</Link>}
          <Link href="/shop" className="btn-outline mt-3 w-full">Continue Shopping</Link>
          <ServerEmptyCart />
        </OrderSummary>
      </div>
    </div>
  );
}

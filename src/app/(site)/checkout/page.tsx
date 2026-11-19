import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { GuestCheckout } from "@/components/checkout/GuestCheckout";
import { getCurrentUser } from "@/lib/auth/guards";
import { formatPeso } from "@/lib/utils/format";
import { getCart } from "@/server/queries/cart";
import { getDefaultAddress } from "@/server/queries/orders";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const current = await getCurrentUser();
  if (current?.profile.role === "admin") redirect("/admin"); // admins don't shop
  if (current?.profile.role === "vendor") redirect("/vendor");
  if (!current) return <GuestCheckout />; // visitors can check out as guests
  const { profile } = current;
  const [cart, address] = await Promise.all([getCart(), getDefaultAddress()]);

  // Nothing to buy, or something in the cart is unavailable: fix it in the cart first.
  if (cart.lines.length === 0 || cart.hasIssues) redirect("/cart");

  const defaults = address
    ? {
        full_name: address.recipient_name, phone: address.phone, line1: address.line1,
        barangay: address.barangay ?? "", city: address.city, province: address.province, postal: address.postal_code ?? "",
      }
    : { full_name: profile.full_name ?? "", phone: profile.phone ?? "" };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl">Checkout</h1>
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_24rem]">
        <CheckoutForm defaults={defaults} />
        <div className="space-y-4">
          <OrderSummary cart={cart} />
          {cart.groups.map((g) => (
            <section key={g.storeId} className="card p-4 text-sm" aria-label={`Items from ${g.storeName}`}>
              <h3 className="!font-sans text-base font-bold text-brand">{g.storeName}</h3>
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
          <p className="text-center text-sm"><Link href="/cart" className="font-semibold text-brand pop hover:text-orange">Edit cart</Link></p>
        </div>
      </div>
    </div>
  );
}

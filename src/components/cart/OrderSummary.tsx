import { formatPeso } from "@/lib/utils/format";
import type { CartTotals } from "@/lib/utils/cart";

/** Totals box. Figures are for display; place_order() recomputes everything from the database. */
export function OrderSummary({ cart, children }: { cart: CartTotals; children?: React.ReactNode }) {
  return (
    <aside className="card h-fit p-5" aria-label="Order summary">
      <h2 className="text-2xl">Order summary</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between"><dt>Items ({cart.itemCount})</dt><dd>{formatPeso(cart.subtotal)}</dd></div>
        <div className="flex justify-between">
          <dt>Shipping ({cart.groups.length} {cart.groups.length === 1 ? "store" : "stores"})</dt>
          <dd>{formatPeso(cart.shipping)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-lg font-bold text-blue">
          <dt>Total</dt><dd>{formatPeso(cart.total)}</dd>
        </div>
      </dl>
      {children}
    </aside>
  );
}

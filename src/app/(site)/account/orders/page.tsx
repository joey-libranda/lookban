import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/order/StatusBadge";
import { requireUser } from "@/lib/auth/guards";
import { formatPeso } from "@/lib/utils/format";
import { formatDateTime, paymentMethodLabel } from "@/lib/utils/labels";
import { getMyOrders } from "@/server/queries/orders";

export const metadata: Metadata = { title: "My Orders" };

export default async function MyOrdersPage() {
  await requireUser("/account/orders");
  const orders = await getMyOrders();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl">My orders</h1>
      {orders.length === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <p className="text-muted">You haven&apos;t placed any orders yet.</p>
          <Link href="/shop" className="btn-primary mt-4">Start Shopping</Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{o.receipt_no}</p>
                <p className="text-sm text-muted">{formatDateTime(o.created_at)} · {o.store_count} {o.store_count === 1 ? "store" : "stores"} · {paymentMethodLabel(o.payment_method)}</p>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={o.status} />
                <span className="font-bold text-blue">{formatPeso(o.total)}</span>
                <Link href={`/orders/${o.id}`} className="font-semibold text-blue pop hover:text-orange">Details</Link>
                <Link href={`/orders/${o.id}/receipt`} className="font-semibold text-blue pop hover:text-orange">Receipt</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

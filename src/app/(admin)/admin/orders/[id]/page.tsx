import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/server/queries/orders";
import { getOrderCommissions } from "@/server/queries/admin";
import { formatPeso } from "@/lib/utils/format";
import { formatDateTime, paymentMethodLabel, paymentStatusLabel } from "@/lib/utils/labels";
import { StatusBadge } from "@/components/order/StatusBadge";
import { StatusSelect } from "@/components/admin/SelectStatus";
import { updateStoreOrderStatusAction } from "@/server/actions/admin";
import { uuid } from "@/lib/validators/admin";

export const metadata: Metadata = { title: "Order · Admin" };

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const o = await getOrder(id); // admin RLS policy lets this read any order
  if (!o) notFound();
  // Totals exclude cancelled stores; for online payments the cancelled amount is what is owed back.
  const cancelledTotal = o.store_orders.filter((x) => x.fulfillment_status === "cancelled").reduce((n, x) => n + x.total, 0);
  const commissions = await getOrderCommissions(o.store_orders.map((x) => x.id));
  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/orders" className="text-sm font-semibold text-blue pop hover:text-orange">← Orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-4xl">{o.receipt_no}</h1><p className="text-muted">Placed {formatDateTime(o.created_at)}</p></div>
        <div className="flex flex-wrap items-center gap-3"><StatusBadge status={o.status} />
          <Link href={`/orders/${o.id}`} className="btn-outline">Order Details</Link>
          <Link href={`/orders/${o.id}/receipt`} className="btn-outline">View Receipt</Link></div>
      </div>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <div><h2 className="label">Customer</h2><p>{o.customer_name}</p><p className="text-muted">{o.customer_phone}{o.customer_email ? ` · ${o.customer_email}` : ""}</p></div>
        <div><h2 className="label">Deliver to</h2><p>{[o.delivery_line1, o.delivery_barangay, o.delivery_city, o.delivery_province, o.delivery_postal].filter(Boolean).join(", ")}</p>
          {o.notes && <p className="mt-1 text-sm text-muted">Note: {o.notes}</p>}</div>
        <div><h2 className="label">Payment</h2><p>{paymentMethodLabel(o.payment_method)}</p><p className="text-muted">{paymentStatusLabel(o.payment_status, o.payment_method)}</p></div>
        <div><h2 className="label">Totals</h2><p>Items {formatPeso(o.subtotal)} · Shipping {formatPeso(o.shipping_total)}</p><p className="font-bold">{formatPeso(o.total)}{cancelledTotal > 0 && <span className="font-normal text-muted"> (cancelled stores excluded)</span>}</p>
          {cancelledTotal > 0 && o.payment_method !== "cod" && <p className="text-sm font-semibold text-red-800">Refund due to customer: {formatPeso(cancelledTotal)}</p>}</div>
      </section>

      {o.store_orders.map((so) => (
        <section key={so.id} className="card p-5" aria-label={so.store_name}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-2xl">{so.store_name}</h2><div className="mt-1 flex flex-wrap items-center gap-2"><StatusBadge status={so.fulfillment_status} />
              {so.received_at && <span className="text-xs text-muted">Customer confirmed received · {formatDateTime(so.received_at)}</span>}</div></div>
            <StatusSelect current={so.fulfillment_status} action={updateStoreOrderStatusAction.bind(null, o.id, so.id)} />
          </div>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-1">Item</th><th className="py-1 text-right">Price</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-line">
              {so.items.map((i) => (
                <tr key={i.id}><td className="py-2">{i.product_name}{i.variant_label && <span className="text-muted"> ({i.variant_label})</span>}</td>
                  <td className="py-2 text-right">{formatPeso(i.price_at_purchase)}</td><td className="py-2 text-right">{i.quantity}</td><td className="py-2 text-right">{formatPeso(i.line_total)}</td></tr>
              ))}
            </tbody>
          </table>
          {so.rating !== null && (
            <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-sm"><span className="font-semibold">Customer rating: {so.rating}/5</span>{so.rating_comment && <span className="text-muted"> - &ldquo;{so.rating_comment}&rdquo;</span>}</p>
          )}
          <p className="mt-3 text-right text-sm text-muted">Shipping {formatPeso(so.shipping_fee)} · <span className="font-bold text-ink">Store total {formatPeso(so.total)}</span></p>
          {(() => {
            const c = commissions.get(so.id);
            if (so.fulfillment_status === "cancelled") return <p className="mt-1 text-right text-xs text-muted">Commission: none (cancelled)</p>;
            if (!c) return null;
            return <p className="mt-1 text-right text-xs text-muted">Commission ({c.rate}% of items): {c.amount === null ? "pending until delivered" : <span className="font-semibold text-ink">{formatPeso(c.amount)}</span>}</p>;
          })()}
        </section>
      ))}
    </div>
  );
}

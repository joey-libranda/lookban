import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireVendor } from "@/lib/auth/guards";
import { getOrder } from "@/server/queries/orders";
import { getVendorCommissions } from "@/server/queries/vendor";
import { formatPeso } from "@/lib/utils/format";
import { formatDateTime, paymentMethodLabel } from "@/lib/utils/labels";
import { StatusBadge } from "@/components/order/StatusBadge";
import { StatusSelect } from "@/components/admin/SelectStatus";
import { updateStoreOrderStatusAction } from "@/server/actions/admin";
import { uuid } from "@/lib/validators/admin";

export const metadata: Metadata = { title: "Order · Vendor" };

export default async function VendorOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { store } = await requireVendor("/vendor/orders");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const o = await getOrder(id); // RLS: a vendor only receives the part of the order that belongs to their own store
  const so = o?.store_orders.find((x) => x.store_id === store.id);
  if (!o || !so) notFound();
  const commission = (await getVendorCommissions([so.id])).get(so.id);
  const cod = o.payment_method === "cod";

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/vendor/orders" className="text-sm font-semibold text-brand pop hover:text-orange">← Orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-4xl">{o.receipt_no}</h1><p className="text-muted">Placed {formatDateTime(o.created_at)}</p></div>
        <StatusBadge status={so.fulfillment_status} />
      </div>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <div><h2 className="label">Customer</h2><p>{o.customer_name}</p><p className="text-muted">{o.customer_phone}{o.customer_email ? ` · ${o.customer_email}` : ""}</p></div>
        <div><h2 className="label">Deliver to</h2><p>{[o.delivery_line1, o.delivery_barangay, o.delivery_city, o.delivery_province, o.delivery_postal].filter(Boolean).join(", ")}</p>
          {o.notes && <p className="mt-1 text-sm text-muted">Note: {o.notes}</p>}</div>
        <div><h2 className="label">Payment</h2><p>{paymentMethodLabel(o.payment_method)}</p>
          <p className="text-sm text-muted">{cod ? `The customer pays ${formatPeso(so.total)} in cash on delivery.` : "Paid online."}</p></div>
      </section>

      <section className="card p-5" aria-label="Your Items">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-2xl">Your Items</h2>
          <StatusSelect current={so.fulfillment_status} action={updateStoreOrderStatusAction.bind(null, o.id, so.id)} />
        </div>
        {so.received_at && <p className="mt-1 text-xs text-muted">Customer confirmed received · {formatDateTime(so.received_at)}</p>}
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
        <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt>Items</dt><dd>{formatPeso(so.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd>{formatPeso(so.shipping_fee)}</dd></div>
          <div className="flex justify-between border-t border-line pt-1 font-bold"><dt>Order total</dt><dd>{formatPeso(so.total)}</dd></div>
          {so.fulfillment_status !== "cancelled" && commission && (
            <div className="flex justify-between pt-1 text-muted"><dt>LOOKBAN commission ({commission.rate}% of items)</dt><dd>{commission.amount === null ? "after delivery" : `- ${formatPeso(commission.amount)}`}</dd></div>
          )}
        </dl>
      </section>
    </div>
  );
}

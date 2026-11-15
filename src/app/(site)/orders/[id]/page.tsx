import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/order/StatusBadge";
import { OrderTracker } from "@/components/order/OrderTracker";
import { getCurrentUser, requireUser } from "@/lib/auth/guards";
import { formatPeso } from "@/lib/utils/format";
import { formatDateTime, paymentMethodLabel } from "@/lib/utils/labels";
import { getOrder, getOrderByToken } from "@/server/queries/orders";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string; t?: string }> };
export const metadata: Metadata = { title: "Order details" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { placed, t } = await searchParams;
  if (!UUID.test(id)) notFound();
  // Two ways in: the secret tracking link (?t=...) for guests, or being logged in as the owner (RLS decides).
  const viaToken = !!t && UUID.test(t);
  if (!viaToken) await requireUser(`/orders/${id}`);
  const order = viaToken ? await getOrderByToken(id, t!) : await getOrder(id);
  if (!order) notFound();
  const current = await getCurrentUser();
  const isGuestView = viaToken && !current;
  const tokenQs = viaToken ? `?t=${t}` : "";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="mb-6">{current && current.profile.role !== "admin"
        ? <Link href="/account/orders" className="font-semibold text-blue pop hover:text-orange">All my orders</Link>
        : current ? <Link href="/admin/orders" className="font-semibold text-blue pop hover:text-orange">Back to admin orders</Link>
        : <Link href="/track" className="font-semibold text-blue pop hover:text-orange">Track another order</Link>}</p>
      {placed && (
        <div role="status" className="mb-8 flex gap-3 rounded-xl bg-green-50 p-5 text-green-900">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0" aria-hidden />
          <div>
            <h1 className="!font-sans text-xl font-bold">Thank you! Your order has been placed.</h1>
            <p className="mt-1 text-sm">Receipt no. <strong>{order.receipt_no}</strong>.</p>
            {isGuestView && (
              <p className="mt-2 text-sm">
                <strong>Save this page&apos;s link</strong> - or your receipt number and mobile number on the{" "}
                <Link href="/track" className="font-semibold pop hover:opacity-70">Track order</Link> page - to follow your order.
                Guest orders aren&apos;t saved to an account; <Link href="/register" className="font-semibold pop hover:opacity-70">register</Link> to keep future orders in one place.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {!placed && <h1 className="text-4xl">Order details</h1>}
          <p className="text-muted">Receipt {order.receipt_no} · {formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex items-center gap-3"><StatusBadge status={order.status} />
          <Link href={`/orders/${order.id}/receipt${tokenQs}`} className="btn-outline !py-2">View / print receipt</Link></div>
      </div>

      <section className="card mt-6 p-5" aria-label="Order progress">
        <h2 className="mb-4 text-xl">Order progress</h2>
        <OrderTracker status={order.status} />
      </section>

      <div className="mt-8 space-y-5">
        {order.store_orders.map((so) => (
          <section key={so.id} className="card p-5" aria-label={`Items from ${so.store_name}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <h2 className="text-xl">{so.store_slug ? <Link href={`/stores/${so.store_slug}`} className="pop hover:text-orange">{so.store_name}</Link> : so.store_name}</h2>
              <StatusBadge status={so.fulfillment_status} />
            </div>
            <ul className="divide-y divide-line">
              {so.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-2.5 text-sm">
                  <span>{i.quantity} × {i.product_name}{i.variant_label ? ` (${i.variant_label})` : ""} <span className="text-muted">@ {formatPeso(i.price_at_purchase)}</span></span>
                  <span className="shrink-0 font-semibold">{formatPeso(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPeso(so.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Shipping</dt><dd>{formatPeso(so.shipping_fee)}</dd></div>
            </dl>
          </section>
        ))}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section className="card p-5 text-sm">
          <h2 className="text-xl">Delivery</h2>
          <p className="mt-2 font-semibold">{order.customer_name}</p>
          <p>{order.customer_phone}</p>
          <p className="mt-1">{[order.delivery_line1, order.delivery_barangay, order.delivery_city, order.delivery_province, order.delivery_postal].filter(Boolean).join(", ")}</p>
          {order.notes && <p className="mt-2 text-muted">Notes: {order.notes}</p>}
        </section>
        <section className="card p-5 text-sm">
          <h2 className="text-xl">Payment</h2>
          <p className="mt-2">{paymentMethodLabel(order.payment_method)}</p>
          <dl className="mt-3 space-y-1 border-t border-line pt-3">
            <div className="flex justify-between"><dt>Items</dt><dd>{formatPeso(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Shipping</dt><dd>{formatPeso(order.shipping_total)}</dd></div>
            <div className="flex justify-between text-lg font-bold text-blue"><dt>Total</dt><dd>{formatPeso(order.total)}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}

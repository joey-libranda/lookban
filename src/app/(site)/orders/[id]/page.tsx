import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/order/StatusBadge";
import { OrderTracker } from "@/components/order/OrderTracker";
import { StoreOrderActions } from "@/components/order/StoreOrderActions";
import { Star } from "lucide-react";
import { getCurrentUser, requireUser } from "@/lib/auth/guards";
import { formatPeso } from "@/lib/utils/format";
import { formatDateTime, paymentMethodLabel } from "@/lib/utils/labels";
import { ReturnStatusBadge } from "@/components/returns/ReturnParts";
import { getOrder, getOrderByToken } from "@/server/queries/orders";
import { getReturnDeadline, getReturnsForStoreOrders } from "@/server/queries/returns";

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
  // Customers (or guests with the link) can act on their order; admins only look.
  const canAct = viaToken || (!!current && current.profile.role === "customer");
  const canRate = !!current && current.profile.role === "customer";
  const isCod = order.payment_method === "cod";
  // Returns are for signed-in customers only (guest returns are not supported yet).
  const delivered = canRate ? order.store_orders.filter((so) => so.fulfillment_status === "delivered") : [];
  const returns = await getReturnsForStoreOrders(delivered.map((so) => so.id));
  const deadlines = new Map(await Promise.all(delivered.map(async (so) => [so.id, await getReturnDeadline(so.id)] as const)));
  const refundedTotal = order.store_orders.reduce((n, so) => n + so.refunded_amount, 0);
  // Cancelled stores are left out of the total; their amount is what may be refunded.
  const cancelledTotal = order.store_orders.filter((so) => so.fulfillment_status === "cancelled").reduce((n, so) => n + so.total, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="mb-6">{current && current.profile.role === "customer"
        ? <Link href="/account/orders" className="inline-flex items-center gap-1.5 font-semibold text-brand pop hover:text-orange"><ArrowLeft className="size-4" aria-hidden /> All My Orders</Link>
        : current ? <Link href="/admin/orders" className="inline-flex items-center gap-1.5 font-semibold text-brand pop hover:text-orange"><ArrowLeft className="size-4" aria-hidden /> Back to Admin Orders</Link>
        : <Link href="/track" className="inline-flex items-center gap-1.5 font-semibold text-brand pop hover:text-orange"><ArrowLeft className="size-4" aria-hidden /> Track Another Order</Link>}</p>
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
          <Link href={`/orders/${order.id}/receipt${tokenQs}`} className="btn-outline !py-2">View / Print Receipt</Link></div>
      </div>

      <section className="card mt-6 p-5" aria-label="Order progress">
        <h2 className="mb-4 text-xl">Order progress</h2>
        <OrderTracker status={order.status} />
      </section>

      <div className="mt-8 space-y-5">
        {order.store_orders.map((so) => (
          <section key={so.id} className={`card p-5 ${so.fulfillment_status === "cancelled" ? "bg-cream/60" : ""}`} aria-label={`Items from ${so.store_name}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <h2 className="text-xl">{so.store_slug ? <Link href={`/stores/${so.store_slug}`} className="pop hover:text-orange">{so.store_name}</Link> : so.store_name}</h2>
              <StatusBadge status={so.fulfillment_status} />
            </div>
            {so.fulfillment_status === "cancelled" && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                Cancelled. This store&apos;s items are not included in your total.
                {!isCod && <> Refund due: <strong>{formatPeso(so.total)}</strong>.</>}
              </p>
            )}
            <ul className="divide-y divide-line">
              {so.items.map((i) => (
                <li key={i.id} className={`flex justify-between gap-4 py-2.5 text-sm ${so.fulfillment_status === "cancelled" ? "text-muted line-through" : ""}`}>
                  <span>{i.quantity} × {i.product_name}{i.variant_label ? ` (${i.variant_label})` : ""} <span className="text-muted">@ {formatPeso(i.price_at_purchase)}</span></span>
                  <span className="shrink-0 font-semibold">{formatPeso(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPeso(so.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Shipping</dt><dd>{formatPeso(so.shipping_fee)}</dd></div>
            </dl>
            {so.rating !== null && (
              <p className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3 text-sm">
                <span className="font-semibold">{canRate ? "Your rating:" : "Customer rating:"}</span>
                {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`size-4 ${n <= so.rating! ? "fill-orange text-orange" : "text-line"}`} aria-hidden />)}
                <span className="sr-only">{so.rating} out of 5</span>
                {so.rating_comment && <span className="basis-full text-muted">&ldquo;{so.rating_comment}&rdquo;</span>}
              </p>
            )}
            {so.refunded_amount > 0 && <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-sm">Refunded: <strong>{formatPeso(so.refunded_amount)}</strong></p>}
            {so.fulfillment_status === "delivered" && canRate && (() => {
              const ret = returns.get(so.id);
              const dl = deadlines.get(so.id);
              if (ret) return (
                <p className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-sm">
                  <span className="font-semibold">Return request:</span> <ReturnStatusBadge status={ret.status} />
                  <Link href={`/account/returns/${ret.id}`} className="font-semibold text-brand pop hover:text-orange">View</Link>
                </p>
              );
              if (dl && new Date(dl) > new Date()) return (
                <p className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm">
                  <span className="text-muted">Something wrong? Ask until {formatDateTime(dl)}.</span>
                  <Link href={`/orders/${order.id}/return/${so.id}`} className="btn-outline !py-2">Request Return or Refund</Link>
                </p>
              );
              return null;
            })()}
            {canAct && (
              <StoreOrderActions orderId={order.id} storeOrderId={so.id} storeName={so.store_name}
                status={so.fulfillment_status} rating={so.rating} canRate={canRate} token={viaToken ? t : undefined}
                cancelNote={isCod ? "You won't be charged for them." : `Refund due for this store: ${formatPeso(so.total)}.`} />
            )}
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
            <div className="flex justify-between text-lg font-bold text-brand"><dt>{cancelledTotal > 0 ? "Total to Pay" : "Total"}</dt><dd>{formatPeso(order.total)}</dd></div>
          </dl>
          {refundedTotal > 0 && <p className="mt-3 flex justify-between rounded-lg bg-cream px-3 py-2"><span>Refunded after delivery</span><strong>{formatPeso(refundedTotal)}</strong></p>}
          {cancelledTotal > 0 && (
            <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-muted">
              {isCod
                ? <>Cancelled stores are not charged. You pay only <strong className="text-ink">{formatPeso(order.total)}</strong> on delivery.</>
                : <>Refund due for cancelled stores: <strong className="text-ink">{formatPeso(cancelledTotal)}</strong>.</>}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/order/PrintButton";
import { requireUser } from "@/lib/auth/guards";
import { formatPeso } from "@/lib/utils/format";
import { formatDateTime, fulfillmentLabel, paymentMethodLabel } from "@/lib/utils/labels";
import { getOrder, getOrderByToken } from "@/server/queries/orders";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> };
export const metadata: Metadata = { title: "Receipt" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Printable receipt. Every figure comes from the order snapshot (price_at_purchase, store_name,
 * delivery fields), so it never changes when catalog prices or profiles change later.
 * Header/footer are hidden when printing; A4 page size is set in globals.css.
 */
export default async function ReceiptPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!UUID.test(id)) notFound();
  const viaToken = !!t && UUID.test(t);
  if (!viaToken) await requireUser(`/orders/${id}/receipt`);
  const order = viaToken ? await getOrderByToken(id, t!) : await getOrder(id);
  if (!order) notFound();
  const hasCancelled = order.store_orders.some((so) => so.fulfillment_status === "cancelled");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/orders/${order.id}${viaToken ? `?t=${t}` : ""}`} className="inline-flex items-center gap-1.5 font-semibold text-brand pop hover:text-orange"><ArrowLeft className="size-4" aria-hidden /> Back to Order</Link>
        <PrintButton />
      </div>

      <article data-theme="light" className="rounded-xl border border-line bg-surface p-8 print:rounded-none print:border-0 print:p-0" aria-label={`Receipt ${order.receipt_no}`}>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-blue pb-5 print:pb-3">
          <div>
            <Image src="/brand/lookban-logo.png" alt="LOOKBAN - local finds, lucban pride" width={170} height={74} />
          </div>
          <div className="text-right text-sm">
            <p className="font-heading text-2xl font-bold tracking-tighter text-brand">Official receipt</p>
            <p><span className="text-muted">Receipt no.</span> <strong>{order.receipt_no}</strong></p>
            <p className="break-all"><span className="text-muted">Order ID</span> {order.id}</p>
            <p><span className="text-muted">Date</span> {formatDateTime(order.created_at)}</p>
          </div>
        </header>

        <section className="mt-5 grid gap-5 text-sm sm:grid-cols-2 print:mt-3">
          <div>
            <h2 className="!font-sans text-xs font-bold uppercase tracking-wide text-muted">Customer</h2>
            <p className="font-semibold">{order.customer_name}</p>
            <p>{order.customer_phone}</p>
            {order.customer_email && <p>{order.customer_email}</p>}
          </div>
          <div>
            <h2 className="!font-sans text-xs font-bold uppercase tracking-wide text-muted">Delivery address</h2>
            <p>{[order.delivery_line1, order.delivery_barangay, order.delivery_city, order.delivery_province, order.delivery_postal].filter(Boolean).join(", ")}</p>
          </div>
        </section>

        {order.store_orders.map((so) => (
          <section key={so.id} className="mt-6 break-inside-avoid print:mt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-t-lg bg-blue-50 px-3 py-2">
              <h2 className="!font-sans text-base font-bold text-brand">{so.store_name}{so.fulfillment_status === "cancelled" && <span className="ml-2 text-sm font-semibold text-red-700">(Cancelled)</span>}</h2>
              <p className="text-xs text-muted">{[so.store_address, so.store_phone].filter(Boolean).join(" · ")}</p>
            </div>
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase text-muted">
                  <th scope="col" className="px-3 py-2 font-semibold">Item</th>
                  <th scope="col" className="w-14 px-3 py-2 text-right font-semibold">Qty</th>
                  <th scope="col" className="w-24 px-3 py-2 text-right font-semibold">Price</th>
                  <th scope="col" className="w-28 px-3 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {so.items.map((i) => (
                  <tr key={i.id} className={`border-b border-line ${so.fulfillment_status === "cancelled" ? "text-muted line-through" : ""}`}>
                    <td className="px-3 py-2">{i.product_name}{i.variant_label && <span className="text-muted"> - {i.variant_label}</span>}</td>
                    <td className="px-3 py-2 text-right">{i.quantity}</td>
                    <td className="px-3 py-2 text-right">{formatPeso(i.price_at_purchase)}</td>
                    <td className="px-3 py-2 text-right">{formatPeso(i.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr><td colSpan={3} className="px-3 pt-2 text-right text-muted">Subtotal</td><td className="px-3 pt-2 text-right">{formatPeso(so.subtotal)}</td></tr>
                <tr><td colSpan={3} className="px-3 text-right text-muted">Shipping</td><td className="px-3 text-right">{formatPeso(so.shipping_fee)}</td></tr>
                {so.fulfillment_status === "cancelled"
                  ? <tr><td colSpan={3} className="px-3 pb-1 text-right font-semibold text-red-700">Cancelled - {order.payment_method === "cod" ? "not charged" : "refund due"}</td><td className="px-3 pb-1 text-right font-semibold text-red-700">{order.payment_method === "cod" ? formatPeso(0) : formatPeso(so.total)}</td></tr>
                  : <tr><td colSpan={3} className="px-3 pb-1 text-right font-semibold">Store total</td><td className="px-3 pb-1 text-right font-semibold">{formatPeso(so.total)}</td></tr>}
              </tfoot>
            </table>
          </section>
        ))}

        <section className="mt-6 grid gap-5 break-inside-avoid border-t-2 border-blue pt-5 text-sm sm:grid-cols-2 print:mt-4 print:pt-3">
          <div className="space-y-1">
            <p><span className="text-muted">Payment method:</span> {paymentMethodLabel(order.payment_method)}</p>
            <p><span className="text-muted">Order status:</span> {fulfillmentLabel(order.status)}</p>
          </div>
          <dl className="space-y-1">
            <div className="flex justify-between"><dt>Items subtotal{hasCancelled && " (cancelled stores excluded)"}</dt><dd>{formatPeso(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Shipping fees</dt><dd>{formatPeso(order.shipping_total)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-xl font-bold text-brand"><dt>Total</dt><dd>{formatPeso(order.total)}</dd></div>
          </dl>
        </section>

        <p className="mt-6 text-center text-xs text-muted print:mt-3">Thank you for supporting Lucban&apos;s local stores. - LOOKBAN, local finds, Lucban pride.</p>
      </article>
    </div>
  );
}

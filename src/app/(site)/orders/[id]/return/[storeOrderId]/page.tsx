import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { ReturnForm } from "@/components/returns/ReturnForm";
import { formatDateTime } from "@/lib/utils/labels";
import { getOrder } from "@/server/queries/orders";
import { getReturnDeadline, getReturnsForStoreOrders } from "@/server/queries/returns";

export const metadata: Metadata = { title: "Return or Refund" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReturnRequestPage({ params }: { params: Promise<{ id: string; storeOrderId: string }> }) {
  const { id, storeOrderId } = await params;
  if (!UUID.test(id) || !UUID.test(storeOrderId)) notFound();
  const user = await requireUser(`/orders/${id}/return/${storeOrderId}`);
  if (user.profile.role !== "customer") redirect(`/orders/${id}`);
  const order = await getOrder(id);
  const so = order?.store_orders.find((s) => s.id === storeOrderId);
  if (!order || !so) notFound();

  const existing = (await getReturnsForStoreOrders([so.id])).get(so.id);
  if (existing) redirect(`/account/returns/${existing.id}`);
  const deadline = so.fulfillment_status === "delivered" ? await getReturnDeadline(so.id) : null;
  const open = !!deadline && new Date(deadline) > new Date();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="mb-6"><Link href={`/orders/${id}`} className="inline-flex items-center gap-1.5 font-semibold text-brand pop hover:text-orange"><ArrowLeft className="size-4" aria-hidden /> Back to Order</Link></p>
      <h1 className="text-4xl">Return or Refund</h1>
      <p className="mt-1 text-muted">{so.store_name} · Order {order.receipt_no}</p>
      {!open ? (
        <p className="card mt-6 p-5">{so.fulfillment_status !== "delivered" ? "You can ask for a return once the store marks the order as delivered." : "The return window for this order has closed."}</p>
      ) : (
        <>
          <p className="mt-4 rounded-lg bg-cream p-4 text-sm">You can send this request until <strong>{formatDateTime(deadline!)}</strong>. {so.store_name} will review it first.</p>
          <div className="mt-6">
            <ReturnForm userId={user.user.id} storeOrderId={so.id} orderId={order.id}
              items={so.items.map((i) => ({ id: i.id, name: i.product_name, variant: i.variant_label ?? "", price: i.price_at_purchase, quantity: i.quantity }))} />
          </div>
        </>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { CompleteReturnForm, ReviewReturnForm } from "@/components/returns/ReturnActions";
import { ReturnBody } from "@/components/returns/ReturnParts";
import { getReturn } from "@/server/queries/returns";

export const metadata: Metadata = { title: "Return Request" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  await requireAdmin(`/admin/returns/${id}`);
  const r = await getReturn(id);
  if (!r) notFound();
  return (
    <div className="space-y-5">
      <p><Link href="/admin/returns" className="inline-flex items-center gap-1.5 font-semibold text-brand pop hover:text-orange"><ArrowLeft className="size-4" aria-hidden /> All Returns</Link></p>
      <p className="text-sm text-muted">Customer: {r.customer_name}</p>
      <ReturnBody r={r} />
      {(r.status === "escalated" || r.status === "requested") && <ReviewReturnForm id={r.id} desired={r.desired} shippingFee={r.shipping_fee} paidOnline={r.paid_online} who="admin" />}
      {r.status === "approved" && <CompleteReturnForm id={r.id} resolution={r.resolution} />}
    </div>
  );
}

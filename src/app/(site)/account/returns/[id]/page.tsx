import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { CustomerReturnActions } from "@/components/returns/ReturnActions";
import { ReturnBody } from "@/components/returns/ReturnParts";
import { getReturn } from "@/server/queries/returns";

export const metadata: Metadata = { title: "Return Details" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  await requireUser(`/account/returns/${id}`);
  const r = await getReturn(id);
  if (!r) notFound();
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-10 sm:px-6">
      <p><Link href="/account/returns" className="inline-flex items-center gap-1.5 font-semibold text-brand pop hover:text-orange"><ArrowLeft className="size-4" aria-hidden /> My Returns</Link></p>
      <ReturnBody r={r} />
      <CustomerReturnActions id={r.id} status={r.status} escalated={!!r.escalated_at} />
      <p className="text-sm"><Link href={`/orders/${r.order_id}`} className="font-semibold text-brand pop hover:text-orange">View the Order</Link></p>
    </div>
  );
}

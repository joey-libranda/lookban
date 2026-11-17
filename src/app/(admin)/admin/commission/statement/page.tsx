import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommissionReport } from "@/server/queries/admin";
import { createClient } from "@/lib/supabase/server";
import { formatPeso } from "@/lib/utils/format";
import { formatDateTime } from "@/lib/utils/labels";
import { uuid } from "@/lib/validators/admin";
import { periodQuery, resolvePeriod } from "@/lib/commission-periods";
import { PrintButton } from "@/components/order/PrintButton";

export const metadata: Metadata = { title: "Commission Statement · Admin" };

/** Printable statement for one period for one store. The admin prints it or saves it as PDF and shares it with the seller. */
export default async function StatementPage({ searchParams }: { searchParams: Promise<{ store?: string; view?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  if (!sp.store || !uuid.safeParse(sp.store).success) notFound();
  const p = resolvePeriod(sp.view, sp.from, sp.to);
  const supabase = await createClient();
  const { data: store } = await supabase.from("stores").select("id, name, address, contact_phone, contact_email").eq("id", sp.store).maybeSingle();
  if (!store) notFound();
  const [row] = await getCommissionReport(p, store.id);
  const period = p.label;
  const back = `/admin/commission?${periodQuery(p)}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Link href={back} className="text-sm font-semibold text-blue pop hover:text-orange">← Commission</Link>
        <PrintButton label="Print Statement" />
      </div>
      <article className="card space-y-5 p-6 print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <Image src="/brand/lookban-wordmark.png" alt="LOOKBAN" width={150} height={46} />
            <p className="mt-1 text-sm text-muted">Local finds, Lucban pride.</p>
          </div>
          <div className="text-right"><h1 className="text-3xl">Commission Statement</h1><p className="text-muted">{period}</p></div>
        </header>
        <section className="text-sm">
          <h2 className="label">Store</h2>
          <p className="font-semibold">{store.name}</p>
          {store.address && <p className="text-muted">{store.address}</p>}
          <p className="text-muted">{[store.contact_phone, store.contact_email].filter(Boolean).join(" · ")}</p>
        </section>
        {!row ? (
          <p className="text-muted">No delivered orders in this period.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr><th className="py-1">Order</th><th className="py-1">Delivered</th><th className="py-1 text-right">Item Sales</th><th className="py-1 text-right">Rate</th><th className="py-1 text-right">Commission</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {row.lines.map((l) => (
                  <tr key={l.store_order_id}><td className="py-2">{l.receipt_no}</td><td className="py-2">{formatDateTime(l.earned_at)}</td>
                    <td className="py-2 text-right">{formatPeso(l.sales)}</td><td className="py-2 text-right">{l.rate}%</td><td className="py-2 text-right">{formatPeso(l.commission)}</td></tr>
                ))}
              </tbody>
            </table>
            <dl className="ml-auto max-w-xs space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt>Delivered sales ({row.orders})</dt><dd>{formatPeso(row.sales)}</dd></div>
              <div className="flex justify-between"><dt>Less: LOOKBAN commission</dt><dd>- {formatPeso(row.commission)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1 text-base font-bold"><dt>Amount owed to store</dt><dd>{formatPeso(row.owed)}</dd></div>
            </dl>
          </>
        )}
        <p className="text-xs text-muted">Shipping fees are not part of sales or commission. Commission is counted only on orders marked Delivered; cancelled orders are not included. This statement is a record for the school-project prototype; no payment is processed through the website.</p>
      </article>
    </div>
  );
}

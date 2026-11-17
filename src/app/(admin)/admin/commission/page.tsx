import type { Metadata } from "next";
import Link from "next/link";
import { getCommissionReport } from "@/server/queries/admin";
import { formatPeso } from "@/lib/utils/format";
import { periodQuery, resolvePeriod } from "@/lib/commission-periods";
import { CommissionPeriodPicker } from "@/components/admin/CommissionPeriodPicker";

export const metadata: Metadata = { title: "Commission · Admin" };

export default async function CommissionPage({ searchParams }: { searchParams: Promise<{ view?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const period = resolvePeriod(sp.view, sp.from, sp.to);
  const rows = await getCommissionReport(period);
  const label = period.label;
  const totals = rows.reduce((t, r) => ({ sales: t.sales + r.sales, commission: t.commission + r.commission, owed: t.owed + r.owed, orders: t.orders + r.orders }), { sales: 0, commission: 0, owed: 0, orders: 0 });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-4xl">Commission</h1>
        <p className="mt-1 max-w-2xl text-muted">
          LOOKBAN&apos;s share of item sales, counted when a store&apos;s part of an order is Delivered. Cancelled orders earn nothing and shipping is not included.
          This is a record only: no money is collected or paid out through the website.
        </p>
      </div>

      <CommissionPeriodPicker period={period} />

      <section className="grid gap-3 sm:grid-cols-4" aria-label={`Totals for ${label}`}>
        {[["Delivered Sales", formatPeso(totals.sales)], ["Commission Earned", formatPeso(totals.commission)], ["Owed to Stores", formatPeso(totals.owed)], ["Delivered Store Orders", String(totals.orders)]].map(([k, v]) => (
          <div key={k} className="card p-4"><p className="text-xs font-bold uppercase text-muted">{k}</p><p className="mt-1 text-2xl font-bold">{v}</p></div>
        ))}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="px-5 pt-5 text-2xl">{label}</h2>
        {rows.length === 0 ? (
          <p className="p-5 text-muted">No delivered orders in this period yet.</p>
        ) : (
          <table className="mt-3 w-full min-w-[40rem] text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr><th className="px-5 py-2">Store</th><th className="py-2 text-right">Orders</th><th className="py-2 text-right">Delivered Sales</th><th className="py-2 text-right">Commission</th><th className="py-2 text-right">Owed to Store</th><th className="px-5 py-2 text-right">Statement</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.store_id}>
                  <td className="px-5 py-3 font-semibold">{r.store_name}</td>
                  <td className="py-3 text-right">{r.orders}</td>
                  <td className="py-3 text-right">{formatPeso(r.sales)}</td>
                  <td className="py-3 text-right">{formatPeso(r.commission)}</td>
                  <td className="py-3 text-right font-bold">{formatPeso(r.owed)}</td>
                  <td className="px-5 py-3 text-right"><Link href={`/admin/commission/statement?store=${r.store_id}&${periodQuery(period)}`} className="font-semibold text-blue hover:text-orange">View</Link></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line font-bold">
              <tr><td className="px-5 py-3">Total</td><td className="py-3 text-right">{totals.orders}</td><td className="py-3 text-right">{formatPeso(totals.sales)}</td><td className="py-3 text-right">{formatPeso(totals.commission)}</td><td className="py-3 text-right">{formatPeso(totals.owed)}</td><td /></tr>
            </tfoot>
          </table>
        )}
      </section>
      <p className="text-sm text-muted">&ldquo;Owed to Store&rdquo; = delivered sales minus commission. For Cash on Delivery the delivery partner collects the cash, so settle it with each store outside the website.</p>
    </div>
  );
}

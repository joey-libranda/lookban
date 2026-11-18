import type { Metadata } from "next";
import Link from "next/link";
import { getDashboard } from "@/server/queries/admin";
import { formatPeso } from "@/lib/utils/format";
import { formatDateTime, paymentMethodLabel } from "@/lib/utils/labels";
import { StatusBadge } from "@/components/order/StatusBadge";

export const metadata: Metadata = { title: "Admin dashboard" };

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-blue">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

export default async function AdminHome() {
  const d = await getDashboard();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl">Dashboard</h1>
        <p className="mt-1 text-muted">A quick look at how LOOKBAN is doing.</p>
      </div>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Customers" value={d.customers} />
        <Stat label="Stores" value={d.stores} />
        <Stat label="Active Products" value={d.products} />
        <Stat label="Orders" value={d.orders} note={`${d.activeOrders} still in progress`} />
      </section>

      <section aria-labelledby="sales" className="card p-5">
        <h2 id="sales" className="text-2xl">Sales Summary</h2>
        <p className="mt-1 text-sm text-muted">Order totals, excluding cancelled orders.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="All Orders Placed" value={formatPeso(d.salesTotal)} />
          <Stat label="Delivered" value={formatPeso(d.deliveredTotal)} note="Completed deliveries" />
          <div className="card p-4">
            <p className="text-sm font-semibold text-muted">By payment method</p>
            <p className="mt-1 text-sm"><span className="font-semibold">{paymentMethodLabel("cod")}:</span> {formatPeso(d.salesCod)}</p>
            <p className="mt-1 text-sm"><span className="font-semibold">{paymentMethodLabel("simulated_online")}:</span> {formatPeso(d.salesSimulated)}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="recent" className="card p-5">
          <div className="flex items-center justify-between">
            <h2 id="recent" className="text-2xl">Recent Orders</h2>
            <Link href="/admin/orders" className="text-sm font-semibold text-blue pop hover:text-orange">All orders</Link>
          </div>
          {d.recent.length === 0 ? <p className="mt-3 text-muted">No orders yet.</p> : (
            <ul className="mt-3 divide-y divide-line">
              {d.recent.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold text-blue pop hover:text-orange">{o.receipt_no}</Link>
                    <p className="text-sm text-muted">{o.customer_name} · {formatDateTime(o.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3"><span className="font-semibold">{formatPeso(o.total)}</span><StatusBadge status={o.status} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="low" className="card p-5">
          <h2 id="low" className="text-2xl">Low Stock</h2>
          {d.lowStock.length === 0 ? <p className="mt-3 text-muted">Nothing running low.</p> : (
            <ul className="mt-3 divide-y divide-line">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <Link href={`/admin/products/${p.id}`} className="min-w-0 font-semibold text-blue pop hover:text-orange">
                    {p.name}{p.variant ? ` (${p.variant})` : ""}<span className="block font-normal text-muted">{p.store}</span>
                  </Link>
                  <span className={p.stock === 0 ? "font-bold text-red-700" : "font-bold"}>{p.stock} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

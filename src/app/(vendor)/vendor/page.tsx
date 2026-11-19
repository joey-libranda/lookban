import type { Metadata } from "next";
import Link from "next/link";
import { requireVendor } from "@/lib/auth/guards";
import { ExpiryNotice } from "@/components/vendor/BusinessDocuments";
import { getStoreDocuments } from "@/server/queries/documents";
import { getVendorDashboard } from "@/server/queries/vendor";
import { formatPeso } from "@/lib/utils/format";
import { formatDateTime } from "@/lib/utils/labels";
import { StatusBadge } from "@/components/order/StatusBadge";

export const metadata: Metadata = { title: "Vendor dashboard" };

function Stat({ label, value, note, href }: { label: string; value: string | number; note?: string; href?: string }) {
  const body = (
    <>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </>
  );
  return href ? <Link href={href} className="card block p-4 hover:border-brand">{body}</Link> : <div className="card p-4">{body}</div>;
}

export default async function VendorHome() {
  const { store } = await requireVendor("/vendor");
  const [d, docs] = await Promise.all([getVendorDashboard(store.id), getStoreDocuments(store.id)]);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl">{store.name}</h1>
        <p className="mt-1 text-muted">Your orders, products and sales on LOOKBAN.</p>
      </div>

      {store.status !== "approved" && (
        <p role="status" className="rounded-lg bg-sun/50 px-4 py-3 text-sm font-semibold">
          Your store is currently {store.status === "pending" ? "waiting for approval" : "suspended"}, so customers can&apos;t see it. Contact LOOKBAN for details.
        </p>
      )}
      <ExpiryNotice expiry={docs?.permit_expiry} />
      {d.pendingProducts > 0 && (
        <p role="status" className="rounded-lg bg-blue-50 px-4 py-3 text-sm">
          <span className="font-semibold">{d.pendingProducts} new product{d.pendingProducts === 1 ? " is" : "s are"} waiting for LOOKBAN&apos;s approval.</span> They will appear in the shop once approved.{" "}
          <Link href="/vendor/products?status=pending" className="font-semibold text-brand pop hover:text-orange">View</Link>
        </p>
      )}
      {d.rejectedProducts > 0 && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-900">
          <span className="font-semibold">{d.rejectedProducts} product{d.rejectedProducts === 1 ? " needs" : "s need"} changes.</span>{" "}
          <Link href="/vendor/products?status=rejected" className="font-semibold underline-offset-2 pop hover:text-orange">See what to fix</Link>
        </p>
      )}

      <section aria-label="Orders" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="To Prepare" value={d.toHandle} note="Pending, confirmed or preparing" href="/vendor/orders?status=pending" />
        <Stat label="Out for Delivery" value={d.outForDelivery} href="/vendor/orders?status=out_for_delivery" />
        <Stat label="Delivered" value={d.delivered} href="/vendor/orders?status=delivered" />
        <Stat label="Active Products" value={d.activeProducts} href="/vendor/products" />
      </section>

      <section aria-labelledby="sales" className="card p-5">
        <h2 id="sales" className="text-2xl">Sales</h2>
        <p className="mt-1 text-sm text-muted">Counted when an order is delivered. Item sales only: shipping is not included. LOOKBAN&apos;s commission is deducted from item sales.</p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {[[d.month.label.replace("This Month — ", ""), d.month], ["All time", d.all]].map(([title, v]) => {
            const x = v as typeof d.all;
            return (
              <div key={String(title)}>
                <h3 className="text-lg font-bold">{String(title)}</h3>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><dt>Delivered sales</dt><dd>{formatPeso(x.sales)}</dd></div>
                  <div className="flex justify-between"><dt>LOOKBAN commission</dt><dd>- {formatPeso(x.commission)}</dd></div>
                  <div className="flex justify-between border-t border-line pt-1 text-base font-bold"><dt>You receive</dt><dd>{formatPeso(x.owed)}</dd></div>
                </dl>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="recent" className="card p-5">
          <div className="flex items-center justify-between">
            <h2 id="recent" className="text-2xl">Recent Orders</h2>
            <Link href="/vendor/orders" className="text-sm font-semibold text-brand pop hover:text-orange">All orders</Link>
          </div>
          {d.recent.length === 0 ? <p className="mt-3 text-muted">No orders yet.</p> : (
            <ul className="mt-3 divide-y divide-line">
              {d.recent.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <Link href={`/vendor/orders/${o.order_id}`} className="font-semibold text-brand pop hover:text-orange">{o.receipt_no}</Link>
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
          {d.lowStock.length === 0 ? <p className="mt-3 text-muted">All products have enough stock.</p> : (
            <ul className="mt-3 divide-y divide-line">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <Link href={`/vendor/products/${p.id}`} className="font-semibold text-brand pop hover:text-orange">{p.name}{p.variant && <span className="font-normal text-muted"> ({p.variant})</span>}</Link>
                  <span className={`font-bold ${p.stock === 0 ? "text-red-700" : "text-orange-600"}`}>{p.stock === 0 ? "Out" : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

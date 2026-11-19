import type { Metadata } from "next";
import Link from "next/link";
import { requireVendor } from "@/lib/auth/guards";
import { getVendorOrders, VENDOR_PAGE_SIZE } from "@/server/queries/vendor";
import { param, parsePage, type RawSearchParams } from "@/lib/search-params";
import { formatPeso } from "@/lib/utils/format";
import { fulfillmentLabel, formatDateTime, paymentMethodLabel } from "@/lib/utils/labels";
import { StatusBadge } from "@/components/order/StatusBadge";
import { ClickableRow } from "@/components/admin/ClickableRow";
import { Pagination } from "@/components/ui/Pagination";

export const metadata: Metadata = { title: "Orders · Vendor" };
const STATUSES = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;

export default async function VendorOrders({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { store } = await requireVendor("/vendor/orders");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === param(sp, "status"));
  const page = parsePage(param(sp, "page"));
  const { rows, count } = await getVendorOrders(store.id, { status, page });
  const chip = (on: boolean) => `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold ${on ? "border-blue bg-blue text-white" : "border-line bg-surface text-ink hover:bg-blue-50"}`;
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Orders</h1>
      <nav aria-label="Status" className="flex flex-wrap gap-2">
        <Link href="/vendor/orders" className={chip(!status)}>All</Link>
        {STATUSES.map((s) => <Link key={s} href={`/vendor/orders?status=${s}`} className={chip(status === s)}>{fulfillmentLabel(s)}</Link>)}
      </nav>
      <p className="text-sm text-muted">{count} order{count === 1 ? "" : "s"}</p>
      <div className="card relative overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-line bg-cream text-xs uppercase text-muted">
            <tr><th className="p-3">Receipt</th><th className="p-3">Customer</th><th className="p-3">Placed</th><th className="p-3">Payment</th><th className="p-3 text-right">Your Total</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">No orders here yet.</td></tr>}
            {rows.map((o) => (
              <ClickableRow key={o.id} href={`/vendor/orders/${o.order_id}`}>
                <td className="p-3"><Link href={`/vendor/orders/${o.order_id}`} className="font-semibold text-brand pop hover:text-orange">{o.receipt_no}</Link></td>
                <td className="p-3">{o.customer_name}</td>
                <td className="p-3">{formatDateTime(o.created_at)}</td>
                <td className="p-3">{paymentMethodLabel(o.payment_method)}</td>
                <td className="p-3 text-right font-semibold">{formatPeso(o.total)}</td>
                <td className="p-3"><StatusBadge status={o.status} /></td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(count / VENDOR_PAGE_SIZE))} params={{ status }} />
    </div>
  );
}

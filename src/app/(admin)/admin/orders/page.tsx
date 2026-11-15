import type { Metadata } from "next";
import Link from "next/link";
import { getAdminOrders, ADMIN_PAGE_SIZE } from "@/server/queries/admin";
import { param, parsePage, type RawSearchParams } from "@/lib/search-params";
import { formatPeso } from "@/lib/utils/format";
import { fulfillmentLabel, formatDateTime, paymentMethodLabel } from "@/lib/utils/labels";
import { StatusBadge } from "@/components/order/StatusBadge";
import { ClickableRow } from "@/components/admin/ClickableRow";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";

export const metadata: Metadata = { title: "Orders · Admin" };
const STATUSES = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const q = param(sp, "q"); const st = param(sp, "status"); const page = parsePage(param(sp, "page"));
  const status = STATUSES.find((s) => s === st);
  const { rows, count } = await getAdminOrders({ q, status, page });
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Orders</h1>
      <form role="search" className="card grid gap-3 p-4 sm:grid-cols-[1fr_12rem_auto]">
        <input name="q" defaultValue={q} className="input" placeholder="Receipt no., customer name or phone…" aria-label="Search orders" />
        <Select name="status" defaultValue={status ?? ""} aria-label="Status">
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{fulfillmentLabel(s)}</option>)}
        </Select>
        <button className="btn-secondary">Filter</button>
      </form>
      <p className="text-sm text-muted">{count} order{count === 1 ? "" : "s"}</p>
      <div className="card relative overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-cream text-xs uppercase text-muted">
            <tr><th className="p-3">Receipt</th><th className="p-3">Customer</th><th className="p-3">Placed</th><th className="p-3">Payment</th><th className="p-3 text-right">Total</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">No orders match.</td></tr>}
            {rows.map((o) => (
              <ClickableRow key={o.id} href={`/admin/orders/${o.id}`}>
                <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-blue pop hover:text-orange">{o.receipt_no}</Link>
                  <span className="block text-muted">{o.store_count} store{o.store_count === 1 ? "" : "s"}</span></td>
                <td className="p-3">{o.customer_name}<span className="block text-muted">{o.customer_phone}</span></td>
                <td className="p-3">{formatDateTime(o.created_at)}</td>
                <td className="p-3">{paymentMethodLabel(o.payment_method)}</td>
                <td className="p-3 text-right font-semibold">{formatPeso(o.total)}</td>
                <td className="p-3"><StatusBadge status={o.status} /></td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(count / ADMIN_PAGE_SIZE))} params={{ q, status }} />
    </div>
  );
}

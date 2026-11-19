import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAdminProducts, getAdminStoreOptions, ADMIN_PAGE_SIZE } from "@/server/queries/admin";
import { param, parsePage, type RawSearchParams } from "@/lib/search-params";
import { formatPeso } from "@/lib/utils/format";
import { Pagination } from "@/components/ui/Pagination";
import { SafeImage } from "@/components/ui/SafeImage";
import { Select } from "@/components/ui/Select";
import { ApprovalBadge } from "@/components/admin/ApprovalBadge";
import { getPendingProductCount } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Products · Admin" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const q = param(sp, "q"), store = param(sp, "store"), status = param(sp, "status");
  const page = parsePage(param(sp, "page"));
  const [{ rows, count }, stores, waiting] = await Promise.all([getAdminProducts({ q, store, status, page }), getAdminStoreOptions(), getPendingProductCount()]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">Products</h1>
        <Link href="/admin/products/new" className="btn-primary"><Plus className="size-4" aria-hidden /> Add Product</Link>
      </div>

      {waiting > 0 && status !== "pending" && (
        <p className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-orange bg-sun/30 p-4">
          <span className="font-semibold">{waiting} product{waiting === 1 ? " is" : "s are"} waiting for your approval.</span>
          <Link href="/admin/products?status=pending" className="btn-primary !py-1.5 text-sm">Review Now</Link>
        </p>
      )}
      <form className="card grid gap-3 p-4 sm:grid-cols-[1fr_12rem_10rem_auto]" role="search">
        <input name="q" defaultValue={q} className="input" placeholder="Search by name…" aria-label="Search Products" />
        <Select name="store" defaultValue={store ?? ""} aria-label="Store">
          <option value="">All Stores</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select name="status" defaultValue={status ?? ""} aria-label="Status">
          <option value="">Any Status</option><option value="pending">Awaiting Approval</option><option value="rejected">Needs Changes</option><option value="active">Active</option><option value="archived">Archived</option><option value="low">Low Stock</option>
        </Select>
        <button className="btn-secondary">Filter</button>
      </form>

      <p className="text-sm text-muted">{count} product{count === 1 ? "" : "s"}{status === "pending" ? " waiting for approval" : ""}</p>
      <div className="card relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line bg-cream text-xs uppercase text-muted">
            <tr><th className="p-3">Product</th><th className="p-3">Store</th><th className="p-3 text-center">Price</th><th className="p-3 text-center">Stock</th><th className="p-3 text-center">Status</th><th className="py-3 pl-3 pr-5 text-center">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">No products match.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="p-3">
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-semibold text-brand">
                    <span className="relative block size-12 shrink-0 overflow-hidden rounded-lg bg-cream"><SafeImage src={p.image} alt={p.name} sizes="48px" compact /></span>
                    <span>{p.name}{p.variant && <span className="block font-normal text-muted">{p.variant}</span>}</span>
                  </Link>
                </td>
                <td className="p-3">{p.store}</td>
                <td className="p-3 text-center">{formatPeso(p.price)}</td>
                <td className={`p-3 text-center font-semibold ${p.stock === 0 ? "text-red-700" : p.stock <= 10 ? "text-orange-600" : ""}`}>{p.stock}</td>
                <td className="p-3 text-center">
                  <ApprovalBadge approval={p.approval} status={p.status} />
                </td>
                <td className="py-3 pl-3 pr-5 text-center">
                  <Link href={`/admin/products/${p.id}`} className={p.approval === "pending" ? "btn-primary !px-4 !py-1.5 text-sm" : "btn-outline !px-4 !py-1.5 text-sm"}>{p.approval === "pending" ? "Review" : "Edit"}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(count / ADMIN_PAGE_SIZE))} params={{ q, store, status }} />
    </div>
  );
}

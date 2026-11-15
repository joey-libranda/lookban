import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAdminProducts, getAdminStoreOptions, ADMIN_PAGE_SIZE } from "@/server/queries/admin";
import { param, parsePage, type RawSearchParams } from "@/lib/search-params";
import { formatPeso } from "@/lib/utils/format";
import { Pagination } from "@/components/ui/Pagination";
import { SafeImage } from "@/components/ui/SafeImage";
import { Select } from "@/components/ui/Select";

export const metadata: Metadata = { title: "Products · Admin" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const q = param(sp, "q"), store = param(sp, "store"), status = param(sp, "status");
  const page = parsePage(param(sp, "page"));
  const [{ rows, count }, stores] = await Promise.all([getAdminProducts({ q, store, status, page }), getAdminStoreOptions()]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">Products</h1>
        <Link href="/admin/products/new" className="btn-primary"><Plus className="size-4" aria-hidden /> Add product</Link>
      </div>

      <form className="card grid gap-3 p-4 sm:grid-cols-[1fr_12rem_10rem_auto]" role="search">
        <input name="q" defaultValue={q} className="input" placeholder="Search by name…" aria-label="Search products" />
        <Select name="store" defaultValue={store ?? ""} aria-label="Store">
          <option value="">All stores</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select name="status" defaultValue={status ?? ""} aria-label="Status">
          <option value="">Any status</option><option value="active">Active</option><option value="archived">Archived</option><option value="low">Low stock</option>
        </Select>
        <button className="btn-secondary">Filter</button>
      </form>

      <p className="text-sm text-muted">{count} product{count === 1 ? "" : "s"}</p>
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
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-semibold text-blue">
                    <span className="relative block size-12 shrink-0 overflow-hidden rounded-lg bg-cream"><SafeImage src={p.image} alt={p.name} sizes="48px" compact /></span>
                    <span>{p.name}{p.variant && <span className="block font-normal text-muted">{p.variant}</span>}</span>
                  </Link>
                </td>
                <td className="p-3">{p.store}</td>
                <td className="p-3 text-center">{formatPeso(p.price)}</td>
                <td className={`p-3 text-center font-semibold ${p.stock === 0 ? "text-red-700" : p.stock <= 10 ? "text-orange-600" : ""}`}>{p.stock}</td>
                <td className="p-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === "active" ? "bg-green-50 text-green-800" : "bg-line text-muted"}`}>{p.status === "active" ? "Active" : "Archived"}</span>
                </td>
                <td className="py-3 pl-3 pr-5 text-center">
                  <Link href={`/admin/products/${p.id}`} className="btn-outline !px-4 !py-1.5 text-sm">Edit</Link>
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

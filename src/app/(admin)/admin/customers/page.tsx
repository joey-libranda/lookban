import type { Metadata } from "next";
import { getAdminCustomers, ADMIN_PAGE_SIZE } from "@/server/queries/admin";
import { param, parsePage, type RawSearchParams } from "@/lib/search-params";
import { Pagination } from "@/components/ui/Pagination";
import { CustomerToggle } from "@/components/admin/CustomerToggle";
import { formatDateTime } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Customers · Admin" };

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const q = param(sp, "q"); const page = parsePage(param(sp, "page"));
  const { rows, count } = await getAdminCustomers({ q, page });
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Customers</h1>
      <form role="search" className="card flex gap-3 p-4">
        <input name="q" defaultValue={q} className="input" placeholder="Search by name or email…" aria-label="Search customers" />
        <button className="btn-secondary">Search</button>
      </form>
      <p className="text-sm text-muted">{count} customer{count === 1 ? "" : "s"}. Deactivated customers cannot log in or place orders.</p>
      <div className="card relative overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-line bg-cream text-xs uppercase text-muted">
            <tr><th className="p-3">Customer</th><th className="p-3">Mobile</th><th className="p-3">Joined</th><th className="p-3">Status</th><th className="py-3 pl-3 pr-6" /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted">No customers found.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="p-3 font-semibold">{c.full_name || "-"}<span className="block font-normal text-muted">{c.email}</span></td>
                <td className="p-3">{c.phone || "-"}</td>
                <td className="p-3">{formatDateTime(c.created_at)}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.is_active ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{c.is_active ? "Active" : "Deactivated"}</span></td>
                <td className="py-3 pl-3 pr-6 text-right">
                  <CustomerToggle id={c.id} name={c.full_name || c.email || "This customer"} active={c.is_active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(count / ADMIN_PAGE_SIZE))} params={{ q }} />
    </div>
  );
}

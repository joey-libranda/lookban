import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAdminStores } from "@/server/queries/admin";
import { formatPeso } from "@/lib/utils/format";
import { ClickableRow } from "@/components/admin/ClickableRow";
import { FlashToast } from "@/components/ui/FlashToast";

export const metadata: Metadata = { title: "Stores · Admin" };

export default async function AdminStores({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const [stores, sp] = await Promise.all([getAdminStores(), searchParams]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">Stores</h1>
        <Link href="/admin/stores/new" className="btn-primary"><Plus className="size-4" aria-hidden /> Add Store</Link>
      </div>
      {sp.deleted && <FlashToast text="Store deleted." />}
      <div className="card relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line bg-cream text-xs uppercase text-muted">
            <tr><th className="p-3">Store</th><th className="p-3 text-center">Status</th><th className="p-3 text-center">Products</th><th className="p-3 text-center">Shipping</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stores.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted">No stores yet.</td></tr>}
            {stores.map((s) => (
              <ClickableRow key={s.id} href={`/admin/stores/${s.id}`}>
                <td className="p-3"><Link href={`/admin/stores/${s.id}`} className="font-semibold text-blue">{s.name}</Link>
                  {s.address && <span className="block text-muted">{s.address}</span>}</td>
                <td className="p-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${s.status === "approved" ? "bg-green-50 text-green-800" : "bg-line text-muted"}`}>{s.status}</span>
                  {!s.is_open && <span className="ml-1 text-xs text-muted">Closed</span>}
                </td>
                <td className="p-3 text-center">{s.product_count}</td>
                <td className="p-3 text-center">{s.shipping_fee == null ? "Default" : formatPeso(s.shipping_fee)}</td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

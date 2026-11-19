import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireVendor } from "@/lib/auth/guards";
import { AdminNav } from "@/components/admin/AdminNav";
import { countReturns } from "@/server/queries/returns";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The vendor area has its own layout, like the admin area. Second layer of protection
 * (the proxy redirects anonymous users; RLS is the final layer and only ever shows a vendor their own store).
 */
export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const { store } = await requireVendor("/vendor");
  const pendingReturns = await countReturns(["requested", "approved"]);
  return (
    <ToastProvider>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)] print:block">
        <aside className="min-w-0 border-b border-line bg-surface px-4 py-4 print:hidden lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <Link href="/vendor" aria-label="LOOKBAN Vendor Dashboard" className="mb-1 inline-block">
            <Image src="/brand/lookban-wordmark.png" alt="LOOKBAN" width={132} height={40} priority />
          </Link>
          <p className="mb-3 truncate text-sm font-semibold text-muted" title={store.name}>{store.name}</p>
          <AdminNav area="vendor" pendingReturns={pendingReturns} />
        </aside>
        <div className="min-w-0 px-4 py-6 sm:px-8">{children}</div>
      </div>
    </ToastProvider>
  );
}

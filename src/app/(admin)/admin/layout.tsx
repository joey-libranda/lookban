import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { AdminNav } from "@/components/admin/AdminNav";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The admin area has its own layout: no storefront header, search bar or footer.
 * Second layer of protection (the proxy redirects anonymous users; RLS is the final layer).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin("/admin");
  return (
    <ToastProvider>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-line bg-white px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-4 lg:py-4">
          <Link href="/admin" aria-label="LOOKBAN admin dashboard" className="mb-3 inline-block">
            <Image src="/brand/lookban-wordmark.png" alt="LOOKBAN" width={132} height={40} priority />
          </Link>
          <AdminNav />
        </aside>
        <div className="min-w-0 px-4 py-6 sm:px-8">{children}</div>
      </div>
    </ToastProvider>
  );
}

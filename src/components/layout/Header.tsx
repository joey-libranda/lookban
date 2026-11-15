import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { CartLink } from "@/components/shop/CartLink";
import { getCurrentUser } from "@/lib/auth/guards";
import { isSupabaseConfigured } from "@/lib/env";
import { getCartCount } from "@/server/queries/cart";
import { NavLinks } from "@/components/layout/NavLinks";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { AccountMenu } from "@/components/layout/AccountMenu";

export async function Header() {
  const [current, cartCount] = await Promise.all([
    getCurrentUser(),
    isSupabaseConfigured() ? getCartCount() : Promise.resolve(0),
  ]);
  const role = current?.profile.role;

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="LOOKBAN home" className="shrink-0">
          <Image src="/brand/lookban-wordmark.png" alt="LOOKBAN" width={132} height={40} priority />
        </Link>

        <nav aria-label="Main" className="ml-4 hidden gap-6 lg:flex">
          <NavLinks variant="bar" />
        </nav>

        <form action="/shop" role="search" className="ml-auto hidden max-w-xs flex-1 md:block">
          <label htmlFor="site-search" className="sr-only">Search products</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="site-search" name="q" type="search" placeholder="Search longganisa, miki, broas…" className="input pl-9" />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <CartLink serverCount={cartCount} />

          {current ? (
            <AccountMenu name={current.profile.full_name?.split(" ")[0] ?? "Account"} isAdmin={role === "admin"} />
          ) : (
            <Link href="/login" className="btn-primary !px-5 !py-2 text-sm">Log In</Link>
          )}

          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

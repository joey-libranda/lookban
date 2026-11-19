"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Store, Tags, ReceiptText, Users, Settings, UserRound, Mail, Globe, Percent, FileCheck2, Undo2 } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LogoutButton } from "@/components/auth/LogoutButton";

const ADMIN_SECTIONS = [
  { title: null, items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  { title: "Sales", items: [
    { href: "/admin/orders", label: "Orders", icon: ReceiptText },
    { href: "/admin/returns", label: "Returns", icon: Undo2 },
    { href: "/admin/commission", label: "Commission", icon: Percent },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/messages", label: "Messages", icon: Mail },
  ] },
  { title: "Catalog", items: [
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/stores", label: "Stores", icon: Store },
    { href: "/admin/applications", label: "Applications", icon: FileCheck2 },
    { href: "/admin/categories", label: "Categories", icon: Tags },
  ] },
  { title: "Site", items: [{ href: "/admin/settings", label: "Settings", icon: Settings }] },
  { title: "Account", items: [
    { href: "/admin/account", label: "My Account", icon: UserRound },
    { href: "/", label: "View Website", icon: Globe, exact: true },
  ] },
];

const VENDOR_SECTIONS = [
  { title: null, items: [{ href: "/vendor", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  { title: "My Shop", items: [
    { href: "/vendor/orders", label: "Orders", icon: ReceiptText },
    { href: "/vendor/returns", label: "Returns", icon: Undo2 },
    { href: "/vendor/products", label: "Products", icon: Package },
    { href: "/vendor/store", label: "Store Info", icon: Store },
  ] },
  { title: "Account", items: [
    { href: "/vendor/account", label: "My Account", icon: UserRound },
    { href: "/", label: "View Website", icon: Globe, exact: true },
  ] },
];

/** Side navigation for the admin area and the vendor area (same look, different links). */
export function AdminNav({ area = "admin", pendingProducts = 0, pendingApplications = 0, pendingReturns = 0 }: { area?: "admin" | "vendor"; pendingProducts?: number; pendingApplications?: number; pendingReturns?: number }) {
  const path = usePathname();
  const SECTIONS = area === "vendor" ? VENDOR_SECTIONS : ADMIN_SECTIONS;
  return (
    <nav aria-label="Admin" className="flex gap-4 overflow-x-auto pb-2 lg:flex-col lg:gap-2 lg:overflow-visible lg:pb-0">
      {SECTIONS.map((sec) => (
        <div key={sec.title ?? "main"} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0 lg:border-t lg:border-line lg:pt-2 first:lg:border-0 first:lg:pt-0">
          {sec.title && <p className="hidden px-3 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-muted lg:block">{sec.title}</p>}
          {sec.items.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? path === href : path.startsWith(href);
            return (
              <Link key={href} href={href === "/admin/products" && pendingProducts > 0 ? "/admin/products?status=pending" : href} aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${active ? "bg-blue text-white" : "text-ink hover:bg-blue-50"}`}>
                <Icon className="size-4" aria-hidden /> {label}
                {href === "/admin/applications" && pendingApplications > 0 && <span className="ml-auto rounded-full bg-orange px-1.5 text-xs font-bold text-white" aria-label={`${pendingApplications} awaiting review`}>{pendingApplications}</span>}
                {(href === "/admin/returns" || href === "/vendor/returns") && pendingReturns > 0 && <span className="ml-auto rounded-full bg-orange px-1.5 text-xs font-bold text-white" aria-label={`${pendingReturns} awaiting a decision`}>{pendingReturns}</span>}
                {href === "/admin/products" && pendingProducts > 0 && <span className="ml-auto rounded-full bg-orange px-1.5 text-xs font-bold text-white" aria-label={`${pendingProducts} awaiting approval`}>{pendingProducts}</span>}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="shrink-0 lg:border-t lg:border-line lg:pt-2"><ThemeToggle variant="nav" /><LogoutButton variant="nav" /></div>
    </nav>
  );
}

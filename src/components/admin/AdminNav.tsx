"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Store, Tags, ReceiptText, Users, Settings, UserRound, Mail, Globe } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";

const SECTIONS = [
  { title: null, items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  { title: "Sales", items: [
    { href: "/admin/orders", label: "Orders", icon: ReceiptText },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/messages", label: "Messages", icon: Mail },
  ] },
  { title: "Catalog", items: [
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/stores", label: "Stores", icon: Store },
    { href: "/admin/categories", label: "Categories", icon: Tags },
  ] },
  { title: "Site", items: [{ href: "/admin/settings", label: "Settings", icon: Settings }] },
  { title: "Account", items: [
    { href: "/admin/account", label: "My account", icon: UserRound },
    { href: "/", label: "View website", icon: Globe, exact: true },
  ] },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-4 overflow-x-auto pb-2 lg:flex-col lg:gap-2 lg:overflow-visible lg:pb-0">
      {SECTIONS.map((sec) => (
        <div key={sec.title ?? "main"} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0 lg:border-t lg:border-line lg:pt-2 first:lg:border-0 first:lg:pt-0">
          {sec.title && <p className="hidden px-3 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-muted lg:block">{sec.title}</p>}
          {sec.items.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? path === href : path.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${active ? "bg-blue text-white" : "text-ink hover:bg-blue-50"}`}>
                <Icon className="size-4" aria-hidden /> {label}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="shrink-0 lg:border-t lg:border-line lg:pt-2"><LogoutButton variant="nav" /></div>
    </nav>
  );
}

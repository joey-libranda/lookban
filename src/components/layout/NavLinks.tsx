"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/stores", label: "Stores" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

/** Main navigation; the link for the page you are on is highlighted in orange. */
export function NavLinks({ variant }: { variant: "bar" | "menu" }) {
  const path = usePathname();
  return (
    <>
      {NAV.map((n) => {
        const on = isActive(path, n.href);
        const cls = variant === "bar"
          ? `pop text-[15px] font-semibold ${on ? "text-orange" : "text-blue hover:text-orange"}`
          : `block rounded-md px-3 py-2 text-sm font-semibold ${on ? "bg-orange/10 text-orange" : "text-blue hover:bg-blue-50"}`;
        return <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={cls}>{n.label}</Link>;
      })}
    </>
  );
}

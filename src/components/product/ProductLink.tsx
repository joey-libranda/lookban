"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Opens the product pop-up on the current page: adds ?product=slug and keeps the other filters in the URL. */
export function useProductHref() {
  const pathname = usePathname();
  const sp = useSearchParams();
  return (slug: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("product", slug);
    return `${pathname}?${params.toString()}`;
  };
}

export function ProductLink({ slug, className, children, tabIndex, ...rest }: {
  slug: string; className?: string; children: React.ReactNode; tabIndex?: number; "aria-label"?: string;
}) {
  const href = useProductHref()(slug);
  return <Link href={href} scroll={false} className={className} tabIndex={tabIndex} {...rest}>{children}</Link>;
}

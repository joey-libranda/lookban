import { discountPercent, formatPeso } from "@/lib/utils/format";

/** Selling price, with the original price crossed out when the product is on promo. */
export function Price({ price, compareAt, className = "text-xl font-bold text-brand", prefix = "" }: {
  price: number; compareAt?: number | null; className?: string; prefix?: string;
}) {
  const on = discountPercent(price, compareAt) !== null;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className={className}>{prefix}{formatPeso(price)}</span>
      {on && <s className="text-sm font-normal text-muted"><span className="sr-only">Original price </span>{formatPeso(compareAt!)}</s>}
    </span>
  );
}

/** "10% OFF" pill. Renders nothing when there is no real discount. */
export function DiscountBadge({ price, compareAt, className = "" }: { price: number; compareAt?: number | null; className?: string }) {
  const pct = discountPercent(price, compareAt);
  if (pct === null) return null;
  return <span className={`rounded-full bg-orange px-3 py-1 text-xs font-bold text-white shadow ${className}`}>{pct}% OFF</span>;
}

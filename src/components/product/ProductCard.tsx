"use client";

import Link from "next/link";
import { useState } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { availability, discountPercent, formatPeso } from "@/lib/utils/format";
import type { ProductListing } from "@/types/catalog";
import { AddToCartButton } from "./AddToCartButton";
import { DiscountBadge, Price } from "./Price";
import { ProductLink, useProductHref } from "./ProductLink";
import { Rating } from "./Rating";
import { StockBadge } from "./StockBadge";
import { Select } from "@/components/ui/Select";

/**
 * One card per store + product. Sizes/packs of the same product are variants of the card, picked in the
 * dropdown; clicking the photo or name opens the product pop-up. Fixed-height rows keep every card the same size.
 */
export function ProductCard({ l, priority }: { l: ProductListing; priority?: boolean }) {
  const productHref = useProductHref();
  const [idx, setIdx] = useState(-1);
  const many = l.items.length > 1;
  // Several variants: nothing is chosen until the customer picks one.
  const chosen = many ? l.items[idx] : l.items[0];
  const v = chosen ?? l.items[0];
  const a = availability(v.stock, l.store.is_open);
  // Badge: the chosen variant's discount, or the best one on the card until a variant is picked.
  const promo = (chosen ? [chosen] : l.items).reduce<{ price: number; compare: number } | null>((best, i) => {
    const pct = discountPercent(i.price, i.compare_at_price);
    if (pct === null) return best;
    return !best || pct > (discountPercent(best.price, best.compare) ?? 0) ? { price: i.price, compare: i.compare_at_price! } : best;
  }, null);
  const labelOf = (i: (typeof l.items)[number]) => i.variant_label || "Regular";

  return (
    <article className="card group relative flex h-full flex-col transition duration-200 hover:z-10 hover:scale-[1.02] hover:shadow-lg">
      <Link href={productHref(v.slug)} scroll={false} aria-label={`View details: ${l.name}`}
            className="relative block aspect-[4/3] overflow-hidden rounded-t-xl bg-line/40">
        <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105">
          <SafeImage src={(v.image ?? l.image)?.url} alt={(v.image ?? l.image)?.alt ?? l.name}
                     sizes="(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw" priority={priority} />
        </div>
        {promo && <DiscountBadge price={promo.price} compareAt={promo.compare} className="absolute right-3 top-3 z-10" />}
        <span className="absolute inset-0 flex items-center justify-center bg-gray-900/0 transition-colors duration-200 group-hover:bg-gray-900/40 group-focus-within:bg-gray-900/40">
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink opacity-0 shadow transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            View details
          </span>
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-1 px-4 pb-3 pt-3.5">
        <Link href={`/stores/${l.store.slug}`} className="block truncate text-xs font-bold uppercase tracking-wide text-orange pop hover:text-orange-600">
          {l.store.name}
        </Link>
        <h3 className="truncate text-lg leading-snug">
          <ProductLink slug={v.slug} className="pop hover:text-orange">{l.name}</ProductLink>
        </h3>

        <div className="mt-1.5 flex h-9 items-center">
          {many ? (
            <Select aria-label={`Choose a variant of ${l.name}`} value={idx} onChange={(v) => setIdx(Number(v))} className="w-full" compact>
              <option value={-1} disabled>Select variant</option>
              {l.items.map((i, n) => <option key={i.id} value={n}>{labelOf(i)} - {formatPeso(i.price)}</option>)}
            </Select>
          ) : (
            <p className="line-clamp-2 text-sm text-muted">{labelOf(v)}</p>
          )}
        </div>
        <Rating rating={l.rating} />

        {/* mt-auto: price + button always sit at the bottom, so cards in a row end level even when one has no rating. */}
        <div className="mt-auto pt-1.5">
          <AddToCartButton key={v.id} productId={v.id} stock={v.stock} disabled={!chosen || !a.canBuy} compact withQuantity
            priceSlot={chosen
              ? (qty: number) => <Price price={times(v.price, qty)} compareAt={v.compare_at_price ? times(v.compare_at_price, qty) : null} />
              : <Price price={Math.min(...l.items.map((i) => i.price))} prefix="From " />} />
          <div className="flex min-h-5 items-center pt-1">{chosen && <StockBadge stock={v.stock} storeOpen={l.store.is_open} />}</div>
        </div>
      </div>
    </article>
  );
}

/** Price x quantity, rounded to centavos. */
const times = (n: number, q: number) => Math.round(n * q * 100) / 100;

export function ProductGrid({ items }: { items: ProductListing[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {items.map((l, i) => <li key={l.key} className="min-w-0"><ProductCard l={l} priority={i < 4} /></li>)}
    </ul>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";
import type { ProductListing } from "@/types/catalog";

/**
 * One-row product carousel. The row moves with a transform (not a scrollbar) so the cards' dropdown
 * lists can still open below them. Buttons move one card at a time; swiping works on touch screens.
 */
export function ProductCarousel({ id, title, items, href }: { id: string; title: string; items: ProductListing[]; href: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [i, setI] = useState(0);
  const [max, setMax] = useState(0);
  const [offsets, setOffsets] = useState<number[]>([]);
  const touchX = useRef<number | null>(null);

  // How many cards fit depends on the screen, so measure instead of guessing.
  const measure = useCallback(() => {
    const t = track.current; if (!t || t.children.length === 0) return;
    const first = t.children[0] as HTMLElement;
    const perView = Math.max(1, Math.round(t.parentElement!.clientWidth / (first.offsetWidth + 16)));
    setMax(Math.max(0, t.children.length - perView));
    setOffsets(Array.from(t.children, (c) => (c as HTMLElement).offsetLeft));
  }, []);
  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure); if (track.current?.parentElement) ro.observe(track.current.parentElement);
    return () => ro.disconnect();
  }, [measure, items.length]);

  const at = Math.min(i, max);
  const go = (to: number) => setI(Math.max(0, Math.min(max, to)));
  const offset = offsets[at] ?? 0;

  const btn = "flex size-9 items-center justify-center rounded-full border-2 border-blue text-blue transition hover:scale-110 hover:bg-blue hover:text-white disabled:pointer-events-none disabled:opacity-30";

  return (
    <section className="mx-auto max-w-7xl px-4 pb-14 pt-16 sm:px-6" aria-labelledby={id} aria-roledescription="carousel">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 id={id} className="text-3xl sm:text-4xl">{title}</h2>
        <div className="flex shrink-0 items-center gap-3">
          <Link href={href} className="mr-1 font-semibold text-blue pop hover:text-orange">View all</Link>
          <button type="button" aria-label="Previous products" disabled={at === 0} onClick={() => go(at - 1)} className={btn}><ChevronLeft className="size-5" aria-hidden /></button>
          <button type="button" aria-label="Next products" disabled={at >= max} onClick={() => go(at + 1)} className={btn}><ChevronRight className="size-5" aria-hidden /></button>
        </div>
      </div>
      {/* Clip sideways only; cards keep their room above/below for hover and dropdowns. */}
      <div className="-mx-1 overflow-x-clip px-1 py-1"
           onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
           onTouchEnd={(e) => { if (touchX.current === null) return; const d = e.changedTouches[0].clientX - touchX.current; if (Math.abs(d) > 50) go(at + (d < 0 ? 1 : -1)); touchX.current = null; }}>
        <ul ref={track} className="flex gap-4 transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${offset}px)` }}>
          {items.map((l, n) => (
            <li key={l.key} className="min-w-0 shrink-0 basis-[calc(50%-0.5rem)] md:basis-[calc(33.333%-0.667rem)] xl:basis-[calc(25%-0.75rem)]">
              <ProductCard l={l} priority={n < 4} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

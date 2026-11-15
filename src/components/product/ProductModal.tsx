"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { availability, formatPeso } from "@/lib/utils/format";
import { getProductModalAction, type ProductModalResult } from "@/server/actions/catalog";
import type { ProductDetail, ProductModalData } from "@/types/catalog";
import { AddToCartButton } from "./AddToCartButton";
import { DiscountBadge, Price } from "./Price";
import { Rating } from "./Rating";
import { StockBadge } from "./StockBadge";

/**
 * The product pop-up. It is driven by `?product=<slug>` in the URL, so any page can open it
 * (cards, compare table, home page), the Back button closes it and the link can be shared.
 */
export function ProductModalHost() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const slug = sp.get("product");

  const close = useCallback(() => {
    const p = new URLSearchParams(sp.toString());
    p.delete("product");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [sp, pathname, router]);

  if (!slug) return null;
  return <ModalShell slug={slug} onClose={close} />;
}

function ModalShell({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [res, setRes] = useState<{ slug: string; r: ProductModalResult } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Load the product (server action; prices/stock always come from the database).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await null;
      const r = await getProductModalAction(slug).catch((): ProductModalResult => ({ ok: false, error: "Couldn't load this product. Please try again." }));
      if (!cancelled) setRes({ slug, r });
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Lock page scroll, close on Escape, keep Tab inside the pop-up, restore focus on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    box.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),select,input,[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); html.style.overflow = prevOverflow; previous?.focus?.(); };
  }, [onClose]);

  const loaded = res && res.slug === slug ? res.r : null;
  const title = loaded?.ok ? loaded.data.variants[0].name : "Product details";

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-gray-900/55" onClick={onClose} aria-hidden />
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
           className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl">
        <button type="button" onClick={onClose} aria-label="Close"
                className="absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-full bg-white/95 text-ink shadow transition hover:scale-110 hover:bg-line">
          <X className="size-4" aria-hidden />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!loaded ? <Skeleton />
            : !loaded.ok ? (
              <div className="p-10 text-center">
                <p className="text-lg font-semibold">{loaded.error}</p>
                <button type="button" onClick={onClose} className="btn-primary mt-5">Close</button>
              </div>
            ) : <ModalBody key={slug} data={loaded.data} slug={slug} />}
        </div>
      </div>
    </div>
  );
}

/** Price x quantity, rounded to centavos. */
const times = (n: number, q: number) => Math.round(n * q * 100) / 100;

function Skeleton() {
  return (
    <div className="grid animate-pulse gap-6 p-5 sm:p-8 md:grid-cols-2" aria-busy="true" aria-label="Loading product">
      <div className="aspect-[4/3] rounded-xl bg-line/60" />
      <div className="space-y-4">
        <div className="h-4 w-1/3 rounded bg-line/60" /><div className="h-9 w-3/4 rounded bg-line/60" />
        <div className="h-8 w-1/4 rounded bg-line/60" /><div className="h-20 rounded bg-line/60" /><div className="h-11 rounded bg-line/60" />
      </div>
    </div>
  );
}

function ModalBody({ data, slug }: { data: ProductModalData; slug: string }) {
  const { variants } = data;
  const [selectedId, setSelectedId] = useState(() => (variants.find((v) => v.slug === slug) ?? variants[0]).id);
  const v = variants.find((x) => x.id === selectedId) ?? variants[0];
  const first = variants[0];
  const a = availability(v.stock, v.store.is_open);
  const store = v.store_full;

  // Photos of the chosen variant; fall back to the product's other photos.
  const own = v.images;
  const all = variants.flatMap((x) => x.images).filter((img, i, arr) => arr.findIndex((o) => o.url === img.url) === i);
  const photos = own.length ? own : all;

  const facts: [string, string | null][] = [
    ["Weight", v.weight], ["Quantity per pack", v.quantity_per_pack],
    ["Packaging", v.packaging], ["Ingredients", v.ingredients], ["Storage", v.storage_instructions],
  ];
  const shownFacts = facts.filter(([, x]) => x);
  const description = v.description ?? variants.find((x) => x.description)?.description ?? null;

  return (
    <div className="grid gap-x-8 gap-y-6 p-5 sm:p-8 md:grid-cols-2">
      <Gallery key={v.id} photos={photos} name={first.name} price={v.price} compareAt={v.compare_at_price} />

      <div className="min-w-0 md:relative">
        <div className="flex flex-col md:absolute md:inset-0">
          {/* Scrolls when the text is long; the buy box below stays in view. */}
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:pr-3">
        <Link href={`/stores/${store.slug}`} className="text-sm font-bold uppercase tracking-wide text-orange pop hover:text-orange-600">{store.name}</Link>
        <h2 className="mt-1 pr-10 text-3xl leading-tight sm:text-4xl">{first.name}</h2>
        {first.category && (
          <p className="mt-1 text-sm text-muted">
            <Link href={`/shop?category=${first.category.slug}`} className="pop hover:text-orange">{first.category.name}</Link>
          </p>
        )}

        {description && <p className="mt-4 text-ink/90">{description}</p>}

        {variants.length > 1 && (
          <div className="mt-4">
            <p id="variant-label" className="text-sm font-semibold">Select variant</p>
            <div role="radiogroup" aria-labelledby="variant-label" className="mt-2 flex flex-col gap-1.5">
              {variants.map((x) => {
                const on = x.id === v.id;
                const out = x.stock <= 0;
                return (
                  <button key={x.id} type="button" role="radio" aria-checked={on} onClick={() => setSelectedId(x.id)}
                          className={`w-full rounded-md border px-3 py-1.5 text-left text-[13px] font-semibold transition
                            ${on ? "border-orange bg-orange text-white" : "border-line bg-white text-ink hover:border-orange"} ${out && !on ? "opacity-60" : ""}`}>
                    {x.variant_label || "Regular"} - {formatPeso(x.price)}{out ? " (Sold out)" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {shownFacts.length > 0 && (
          <dl className="mt-4 divide-y divide-line rounded-xl border border-line">
            {shownFacts.map(([k, x]) => (
              <div key={k} className="grid grid-cols-3 gap-3 px-4 py-3 text-sm"><dt className="font-semibold">{k}</dt><dd className="col-span-2">{x}</dd></div>
            ))}
          </dl>
        )}
          </div>
          <div className="mt-4 md:border-t md:border-line md:pt-3">
        <div className="flex flex-wrap items-center gap-3">
          <StockBadge stock={v.stock} storeOpen={v.store.is_open} />
          {a.canBuy && v.stock > 0 && <span className="text-sm text-muted">{v.stock} available</span>}
          <Rating rating={v.rating} />
        </div>

        <div className="mt-3">
          <AddToCartButton key={v.id} productId={v.id} stock={v.stock} disabled={!a.canBuy} withQuantity
            priceSlot={(qty: number) => <Price price={times(v.price, qty)} compareAt={v.compare_at_price ? times(v.compare_at_price, qty) : null} className="text-3xl font-bold text-blue" />} />
        </div>

          </div>
        </div>
      </div>

    </div>
  );
}

function Gallery({ photos, name, price, compareAt }: { photos: ProductDetail["images"]; name: string; price: number; compareAt: number | null }) {
  const [i, setI] = useState(0);
  const main = photos[i] ?? photos[0];
  return (
    <div className="min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-line/40 md:aspect-square">
        <SafeImage src={main?.url} alt={main?.alt ?? name} sizes="(min-width:768px) 480px, 100vw" priority />
        <DiscountBadge price={price} compareAt={compareAt} className="absolute left-3 top-3 z-10" />
      </div>
      {photos.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2">
          {photos.slice(0, 5).map((img, n) => (
            <li key={img.url}>
              <button type="button" onClick={() => setI(n)} aria-label={`Show photo ${n + 1}`} aria-current={n === i}
                      className={`relative block aspect-square w-full overflow-hidden rounded-lg border-2 transition hover:scale-105 ${n === i ? "border-orange" : "border-line"}`}>
                <SafeImage src={img.url} alt="" sizes="96px" compact />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

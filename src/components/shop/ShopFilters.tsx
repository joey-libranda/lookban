"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SORT_OPTIONS, type CategoryData, type SortKey, type StoreData } from "@/types/catalog";
import { Select } from "@/components/ui/Select";
import { useShopTransition } from "./ShopTransition";

type Props = {
  action: string;
  q?: string; category?: string; store?: string; sort: SortKey; view?: string; sale?: boolean;
  categories: Pick<CategoryData, "slug" | "name">[];
  stores?: Pick<StoreData, "slug" | "name">[]; // omitted on a store's own page
};

type F = { q: string; category: string; store: string; sort: string };

/**
 * Filter bar. Changing anything updates the URL in place (no page reload, no scroll jump), so only the product
 * results refresh. Filters stay in the URL, so results are still shareable. Pressing Enter / Apply also works.
 */
export function ShopFilters({ action, sale, q = "", category = "", store = "", sort, view, categories, stores }: Props) {
  const router = useRouter();
  const { run } = useShopTransition();
  const [f, setF] = useState<F>({ q, category, store, sort });
  const pushed = useRef<F>({ q, category, store, sort }); // what the URL was last set to by this bar

  // Back/forward button or a link elsewhere changed the URL: follow it (but never fight what is being typed).
  useEffect(() => {
    const next = { q, category, store, sort };
    if (JSON.stringify(next) !== JSON.stringify(pushed.current)) { pushed.current = next; setF(next); }
  }, [q, category, store, sort]);

  function go(next: F) {
    pushed.current = next;
    const p = new URLSearchParams();
    if (next.q.trim()) p.set("q", next.q.trim());
    if (next.category) p.set("category", next.category);
    if (next.store) p.set("store", next.store);
    if (next.sort && next.sort !== "newest") p.set("sort", next.sort);
    if (view) p.set("view", view);
    if (sale) p.set("sale", "1");
    const qs = p.toString();
    run(() => router.replace(qs ? `${action}?${qs}` : action, { scroll: false }));
  }

  // Typing in the search box applies itself after a short pause.
  useEffect(() => {
    if (f.q.trim() === pushed.current.q.trim()) return;
    const t = setTimeout(() => go(f), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.q]);

  function change(patch: Partial<F>) { const next = { ...f, ...patch }; setF(next); go(next); }

  const active = !!(q || category || store || sale);
  return (
    <form onSubmit={(e) => { e.preventDefault(); go(f); }} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-12" role="search" aria-label="Filter products">
      <div className={`sm:col-span-2 ${stores ? "lg:col-span-4" : "lg:col-span-5"}`}>
        <div className="flex items-baseline justify-between">
          <label htmlFor="f-q" className="label">Search</label>
          {active && (
            <button type="button" className="mb-1.5 text-sm font-semibold text-blue pop hover:text-orange"
                    onClick={() => { const next = { q: "", category: "", store: "", sort: f.sort }; setF(next); go(next); }}>
              Clear Filters
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input id="f-q" name="q" type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })}
                 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(f); } }} placeholder="e.g. longganisa" className="input pl-9" />
        </div>
      </div>
      <div className={stores ? "lg:col-span-3" : "lg:col-span-4"}>
        <label htmlFor="f-cat" className="label">Category</label>
        <Select id="f-cat" name="category" value={f.category} onChange={(v) => change({ category: v })}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </Select>
      </div>
      {stores && (
        <div className="lg:col-span-3">
          <label htmlFor="f-store" className="label">Store</label>
          <Select id="f-store" name="store" value={f.store} onChange={(v) => change({ store: v })}>
            <option value="">All stores</option>
            {stores.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </Select>
        </div>
      )}
      <div className={stores ? "lg:col-span-2" : "lg:col-span-3"}>
        <label htmlFor="f-sort" className="label">Sort by</label>
        <Select id="f-sort" name="sort" value={f.sort} onChange={(v) => change({ sort: v })}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
    </form>
  );
}

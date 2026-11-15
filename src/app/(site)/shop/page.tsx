import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/product/ProductCard";
import { CompareTable } from "@/components/product/CompareTable";
import { groupByProduct } from "@/lib/utils/compare";
import { ShopFilters } from "@/components/shop/ShopFilters";
import { PendingRegion, ShopTransition } from "@/components/shop/ShopTransition";
import { Pagination } from "@/components/ui/Pagination";
import { param, parsePage, parseSort, type RawSearchParams } from "@/lib/search-params";
import { getCategories, getProducts, getStores } from "@/server/queries/catalog";

export const metadata: Metadata = {
  title: "Shop Lucban pasalubong",
  description: "Browse and compare Lucban longganisa, miki, biscuits and more from many local stores.",
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const q = param(sp, "q"), category = param(sp, "category"), store = param(sp, "store");
  const sort = parseSort(param(sp, "sort"));
  const compare = param(sp, "view") === "compare";
  const sale = param(sp, "sale") === "1";
  const page = parsePage(param(sp, "page"));

  const [result, categories, stores] = await Promise.all([
    getProducts({ q, category, store, sale, sort: compare ? "price_asc" : sort, page, pageSize: compare ? 60 : undefined }),
    getCategories(),
    getStores(),
  ]);

  const baseParams = { q, category, store, sale: sale ? "1" : undefined, sort: sort === "newest" ? undefined : sort, view: compare ? "compare" : undefined };
  const toggleHref = (view: "grid" | "compare") => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...baseParams, view: view === "compare" ? "compare" : undefined })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/shop?${s}` : "/shop";
  };
  const activeCategory = categories.find((c) => c.slug === category);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl">{sale ? "On Sale" : activeCategory ? activeCategory.name : "Shop All Products"}</h1>
      <p className="mt-1 max-w-2xl text-muted">
        {activeCategory?.description ?? "Every listing shows which Lucban store sells it, so you can compare and choose."}
      </p>

      <ShopTransition>
      <div className="mt-6">
        <ShopFilters action="/shop" sale={sale} q={q} category={category} store={store} sort={sort}
                     view={compare ? "compare" : undefined} categories={categories} stores={stores} />
      </div>

      <PendingRegion>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {result.total} {result.total === 1 ? "product" : "products"}{q ? ` for “${q}”` : ""}
        </p>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm font-semibold" role="group" aria-label="View mode">
          <Link href={toggleHref("grid")} aria-current={!compare} className={`px-4 py-2 ${!compare ? "bg-blue text-white" : "hover:bg-blue-50"}`}>Grid</Link>
          <Link href={toggleHref("compare")} aria-current={compare} className={`px-4 py-2 ${compare ? "bg-blue text-white" : "hover:bg-blue-50"}`}>Compare stores</Link>
        </div>
      </div>

      <div className="mt-4">
        {result.items.length === 0 ? (
          <div className="card p-10 text-center">
            <h2 className="text-2xl">No products found</h2>
            <p className="mt-2 text-muted">Try a different search or clear the filters.</p>
            <Link href="/shop" className="btn-primary mt-5">Clear Filters</Link>
          </div>
        ) : compare ? (
          <div className="space-y-6">
            {groupByProduct(result.items.flatMap((l) => l.items)).map((g) => <CompareTable key={g.key} group={g} />)}
          </div>
        ) : (
          <ProductGrid items={result.items} />
        )}
      </div>

      {!compare && <Pagination page={result.page} pageCount={result.pageCount} params={baseParams} />}
      </PendingRegion>
      </ShopTransition>
    </div>
  );
}

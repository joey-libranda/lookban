import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product/ProductCard";
import { ShopFilters } from "@/components/shop/ShopFilters";
import { Pagination } from "@/components/ui/Pagination";
import { SafeImage } from "@/components/ui/SafeImage";
import { param, parsePage, parseSort, type RawSearchParams } from "@/lib/search-params";
import { getProducts, getStoreBySlug, getStoreCategories } from "@/server/queries/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const store = await getStoreBySlug((await params).slug);
  return store ? { title: store.name, description: store.description ?? undefined } : { title: "Store not found" };
}

export default async function StorePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  const q = param(sp, "q"), category = param(sp, "category");
  const sort = parseSort(param(sp, "sort"));
  const page = parsePage(param(sp, "page"));
  const [result, categories] = await Promise.all([
    getProducts({ store: slug, q, category, sort, page }),
    getStoreCategories(store.id),
  ]);

  return (
    <div>
      <div className="relative h-44 bg-blue sm:h-60">
        <SafeImage src={store.cover_url} alt={`${store.name} cover photo`} sizes="100vw" priority />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="-mt-10 flex flex-wrap items-end gap-4 sm:-mt-12">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border-4 border-white bg-blue shadow sm:size-28">
            {store.logo_url
              ? <SafeImage src={store.logo_url} alt={`${store.name} logo`} sizes="112px" />
              : <span className="flex size-full items-center justify-center font-display text-4xl text-white" aria-hidden>{store.name[0]}</span>}
          </div>
          <div className="mt-14 self-start sm:mt-16">
            <h1 className="text-3xl sm:text-4xl">{store.name}</h1>
            <p className="mt-1 text-sm">
              <span className={`font-semibold ${store.is_open ? "text-green-800" : "text-muted"}`}>{store.is_open ? "Open for orders" : "Currently closed"}</span>
              <span className="text-muted"> · {store.product_count} {store.product_count === 1 ? "product" : "products"}</span>
            </p>
          </div>
        </header>

        <div className="mt-4 border-t border-line pt-4">
          {store.description && <p className="text-ink/90">{store.description}</p>}
          {(store.opening_hours || store.contact_phone || store.contact_email) && (
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
              {store.opening_hours && <li>Hours: {store.opening_hours}</li>}
              {store.contact_phone && <li>Phone: {store.contact_phone}</li>}
              {store.contact_email && <li>Email: {store.contact_email}</li>}
            </ul>
          )}
          {!store.is_open && <p className="mt-3 rounded-lg bg-line px-3 py-2 text-sm">This store is closed right now, so its products can&apos;t be ordered.</p>}
        </div>

        <section className="mt-10" aria-labelledby="store-products">
          <h2 id="store-products" className="mb-4 text-3xl">Products</h2>
          <ShopFilters action={`/stores/${slug}`} q={q} category={category} sort={sort} categories={categories} />
          <div className="mt-6">
            {result.items.length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-muted">{store.product_count === 0 ? "This store hasn't listed any products yet." : "No products match your filters."}</p>
                {store.product_count > 0 && <Link href={`/stores/${slug}`} className="btn-primary mt-4">Clear Filters</Link>}
              </div>
            ) : <ProductGrid items={result.items} />}
          </div>
          <Pagination page={result.page} pageCount={result.pageCount} params={{ q, category, sort: sort === "newest" ? undefined : sort }} />
        </section>
      </div>
    </div>
  );
}

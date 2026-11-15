import Link from "next/link";
import { Search } from "lucide-react";
import { SORT_OPTIONS, type CategoryData, type SortKey, type StoreData } from "@/types/catalog";
import { Select } from "@/components/ui/Select";

type Props = {
  action: string;
  q?: string; category?: string; store?: string; sort: SortKey; view?: string; sale?: boolean;
  categories: Pick<CategoryData, "slug" | "name">[];
  stores?: Pick<StoreData, "slug" | "name">[]; // omitted on a store's own page
};

/** Plain GET form: works without JavaScript and keeps every filter in the URL (shareable). */
export function ShopFilters({ action, sale, q, category, store, sort, view, categories, stores }: Props) {
  const active = !!(q || category || store || sale);
  return (
    <form action={action} method="get" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-12" role="search" aria-label="Filter products">
      <div className="sm:col-span-2 lg:col-span-4">
        <label htmlFor="f-q" className="label">Search</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input id="f-q" name="q" type="search" defaultValue={q} placeholder="e.g. longganisa" className="input pl-9" />
        </div>
      </div>
      <div className="lg:col-span-2">
        <label htmlFor="f-cat" className="label">Category</label>
        <Select id="f-cat" name="category" defaultValue={category ?? ""}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </Select>
      </div>
      {stores && (
        <div className="lg:col-span-2">
          <label htmlFor="f-store" className="label">Store</label>
          <Select id="f-store" name="store" defaultValue={store ?? ""}>
            <option value="">All stores</option>
            {stores.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </Select>
        </div>
      )}
      <div className={stores ? "lg:col-span-2" : "lg:col-span-3"}>
        <label htmlFor="f-sort" className="label">Sort by</label>
        <Select id="f-sort" name="sort" defaultValue={sort}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
      {view && <input type="hidden" name="view" value={view} />}
      {sale && <input type="hidden" name="sale" value="1" />}
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
        <button type="submit" className="btn-primary flex-1">Apply</button>
        {active && <Link href={action} className="btn-outline !px-3">Clear</Link>}
      </div>
    </form>
  );
}

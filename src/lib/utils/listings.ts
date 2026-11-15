import type { ProductCardData, ProductListing, SortKey } from "@/types/catalog";

/** Same product + same store = one listing. Different sizes/packs become variants of that listing. */
export function groupListings(rows: ProductCardData[]): ProductListing[] {
  const map = new Map<string, ProductCardData[]>();
  for (const p of rows) {
    const key = `${p.store.id}:${p.name.trim().toLowerCase()}`;
    const list = map.get(key);
    if (list) list.push(p); else map.set(key, [p]);
  }
  return [...map.entries()].map(([key, items]) => {
    items.sort((a, b) => a.price - b.price);
    const rated = items.filter((i) => i.rating);
    const n = rated.reduce((s, i) => s + i.rating!.count, 0);
    return {
      key, name: items[0].name, store: items[0].store, category: items[0].category,
      image: items.find((i) => i.image)?.image ?? null,
      items,
      rating: n ? { avg: rated.reduce((s, i) => s + i.rating!.avg * i.rating!.count, 0) / n, count: n } : null,
      sold_count: items.reduce((s, i) => s + i.sold_count, 0),
      created_at: items.reduce((m, i) => (i.created_at > m ? i.created_at : m), ""),
    };
  });
}

const low = (l: ProductListing) => l.items[0].price;
const high = (l: ProductListing) => l.items[l.items.length - 1].price;

export function sortListings(list: ProductListing[], sort: SortKey | undefined): ProductListing[] {
  const byName = (a: ProductListing, b: ProductListing) => a.name.localeCompare(b.name) || a.store.name.localeCompare(b.store.name);
  const sorted = [...list];
  switch (sort) {
    case "price_asc": return sorted.sort((a, b) => low(a) - low(b) || byName(a, b));
    case "price_desc": return sorted.sort((a, b) => high(b) - high(a) || byName(a, b));
    case "name_asc": return sorted.sort(byName);
    case "bestselling": return sorted.sort((a, b) => b.sold_count - a.sold_count || byName(a, b));
    default: return sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : byName(a, b)));
  }
}

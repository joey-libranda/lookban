import type { ProductCardData as CatalogProduct } from "@/types/catalog";

export interface UnitPrice { value: number; unit: "per 100g" | "per piece" }

/**
 * A comparable price when pack sizes differ.
 * Uses the weight when it is given in grams ("250g", "approx. 480-500g" -> uses the figure directly before the "g"),
 * otherwise a "dozen" pack count. Returns null when it cannot be derived honestly.
 */
export function unitPrice(p: Pick<CatalogProduct, "price" | "weight" | "quantity_per_pack">): UnitPrice | null {
  const grams = p.weight?.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (grams) return { value: (p.price / Number(grams[1])) * 100, unit: "per 100g" };
  if (p.quantity_per_pack && /\bdozen\b/i.test(p.quantity_per_pack)) {
    const n = Number(p.quantity_per_pack.match(/^(\d+)/)?.[1] ?? 1);
    return { value: p.price / (12 * n), unit: "per piece" };
  }
  return null;
}

export interface ProductGroup {
  key: string;
  name: string;
  items: CatalogProduct[];      // sorted by price ascending
  storeCount: number;
}

/** Group listings of the same product (same name) from different stores. */
export function groupByProduct(products: CatalogProduct[]): ProductGroup[] {
  const map = new Map<string, CatalogProduct[]>();
  for (const p of products) {
    const key = p.name.trim().toLowerCase();
    map.set(key, [...(map.get(key) ?? []), p]);
  }
  return [...map.entries()]
    .map(([key, items]) => ({
      key,
      name: items[0].name,
      items: items.sort((a, b) => a.price - b.price),
      storeCount: new Set(items.map((i) => i.store.id)).size,
    }))
    // Most-compared products first, then alphabetical.
    .sort((a, b) => b.storeCount - a.storeCount || a.name.localeCompare(b.name));
}

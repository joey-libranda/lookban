import "server-only";
import { createClient } from "@/lib/supabase/server";
import { groupListings, sortListings } from "@/lib/utils/listings";
import type {
  CategoryData, ProductCardData, ProductDetail, ProductImage, ProductListing, ProductModalData, SortKey, StoreData,
} from "@/types/catalog";

/* All reads go through the per-request Supabase client, so Row Level Security decides
   what is visible (only active products of approved stores for the public). */

export const PAGE_SIZE = 24;

// PostgREST rows are untyped until we generate Database types; they are normalised right below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

function pickImages(raw: Raw): ProductImage[] {
  const imgs: Raw[] = [...(raw.images ?? [])];
  imgs.sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position);
  return imgs.map((i) => ({ url: i.url, alt: i.alt ?? null }));
}

function toCard(raw: Raw): ProductCardData {
  const store = first<Raw>(raw.store)!;
  const category = first<Raw>(raw.category);
  const images = pickImages(raw);
  return {
    id: raw.id, slug: raw.slug, name: raw.name, variant_label: raw.variant_label ?? "",
    price: Number(raw.price), compare_at_price: raw.compare_at_price == null ? null : Number(raw.compare_at_price), stock: raw.stock, weight: raw.weight ?? null,
    quantity_per_pack: raw.quantity_per_pack ?? null, sold_count: raw.sold_count ?? 0, created_at: raw.created_at ?? "",
    store: { id: store.id, slug: store.slug, name: store.name, is_open: store.is_open },
    category: category ? { slug: category.slug, name: category.name } : null,
    image: images[0] ?? null,
    rating: null,
  };
}

/** Attach average ratings. Products with no reviews keep rating = null (never show fake stars). */
async function withRatings(items: ProductCardData[]): Promise<ProductCardData[]> {
  if (items.length === 0) return items;
  const supabase = await createClient();
  const { data } = await supabase.from("reviews").select("product_id, rating").in("product_id", items.map((p) => p.id));
  const agg = new Map<string, { sum: number; n: number }>();
  for (const r of data ?? []) {
    const a = agg.get(r.product_id) ?? { sum: 0, n: 0 };
    a.sum += r.rating; a.n += 1; agg.set(r.product_id, a);
  }
  return items.map((p) => {
    const a = agg.get(p.id);
    return a ? { ...p, rating: { avg: a.sum / a.n, count: a.n } } : p;
  });
}

const CARD_FIELDS =
  "id, slug, name, variant_label, price, compare_at_price, stock, weight, quantity_per_pack, sold_count, created_at";
const IMAGES = "images:product_images(url, alt, position, is_primary)";

export interface ProductFilters {
  q?: string; category?: string; store?: string; sale?: boolean; sort?: SortKey; page?: number; pageSize?: number;
}

/** Strip characters that have meaning inside PostgREST filter strings. */
const cleanSearch = (q: string) => q.replace(/[%,()*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

/** Matching rows are loaded together and grouped into listings (one per store + product name), then paged. */
const MAX_ROWS = 1000;

export async function getProducts(f: ProductFilters = {}) {
  const supabase = await createClient();
  const pageSize = f.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, f.page ?? 1);

  // Resolve slugs to ids first and filter on plain columns (no embedded-resource filters,
  // which are easy to get subtly wrong). An unknown slug simply yields no products.
  const empty = { items: [] as ProductListing[], total: 0, page, pageSize, pageCount: 1 };
  let storeId: string | undefined, categoryId: string | undefined;
  if (f.store) {
    const { data } = await supabase.from("stores").select("id").eq("slug", f.store).eq("status", "approved").maybeSingle();
    if (!data) return empty;
    storeId = data.id;
  }
  if (f.category) {
    const { data } = await supabase.from("categories").select("id").eq("slug", f.category).maybeSingle();
    if (!data) return empty;
    categoryId = data.id;
  }

  let query = supabase
    .from("products")
    .select(`${CARD_FIELDS}, store:stores(id, slug, name, is_open), category:categories(slug, name), ${IMAGES}`)
    .eq("status", "active");

  if (storeId) query = query.eq("store_id", storeId);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (f.sale) query = query.not("compare_at_price", "is", null);
  const q = f.q ? cleanSearch(f.q) : "";
  if (q) query = query.or(`name.ilike.%${q}%,variant_label.ilike.%${q}%,description.ilike.%${q}%`);

  const { data, error } = await query.order("name").range(0, MAX_ROWS - 1);
  if (error) throw new Error(`Could not load products: ${error.message}`);

  const rows = await withRatings((data ?? []).map(toCard));
  const listings = sortListings(groupListings(rows), f.sort);
  const from = (page - 1) * pageSize;
  return {
    items: listings.slice(from, from + pageSize), total: listings.length, page, pageSize,
    pageCount: Math.max(1, Math.ceil(listings.length / pageSize)),
  };
}

const DETAIL_FIELDS =
  "description, packaging, ingredients, storage_instructions";

/** The product behind a slug with all its variants (same store + name), plus the same product at other stores. */
export async function getProductModal(slug: string): Promise<ProductModalData | null> {
  const supabase = await createClient();
  const { data: base, error: e1 } = await supabase.from("products").select("store_id, name")
    .eq("slug", slug).eq("status", "active").maybeSingle();
  if (e1) throw new Error(`Could not load product: ${e1.message}`);
  if (!base) return null;

  const { data, error } = await supabase
    .from("products")
    .select(
      `${CARD_FIELDS}, ${DETAIL_FIELDS}, store:stores(id, slug, name, address, contact_phone, contact_email, is_open), category:categories(slug, name), ${IMAGES}`,
    )
    .eq("store_id", base.store_id).eq("name", base.name).eq("status", "active").order("price");
  if (error) throw new Error(`Could not load product: ${error.message}`);
  if (!data?.length) return null;

  const cardsWithRatings = await withRatings(data.map(toCard));
  const variants: ProductDetail[] = data.map((row: Raw, i: number) => {
    const store = first<Raw>(row.store)!;
    return {
      ...cardsWithRatings[i],
      description: row.description ?? null, packaging: row.packaging ?? null,
      ingredients: row.ingredients ?? null, storage_instructions: row.storage_instructions ?? null,
      images: pickImages(row),
      store_full: {
        id: store.id, slug: store.slug, name: store.name, address: store.address ?? null,
        contact_phone: store.contact_phone ?? null, contact_email: store.contact_email ?? null, is_open: store.is_open,
      },
    };
  });
  return { variants };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cards(build: (q: any) => any, limit: number) {
  const supabase = await createClient();
  const base = supabase
    .from("products")
    .select(`${CARD_FIELDS}, store:stores(id, slug, name, is_open), category:categories(slug, name), ${IMAGES}`)
    .eq("status", "active");
  const { data, error } = await build(base).limit(limit);
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return withRatings((data ?? []).map(toCard));
}

/** Products for the homepage: bestsellers if any sales exist, otherwise newest. */
export async function getFeaturedProducts(limit = 8) {
  const best = sortListings(groupListings(await cards((q) => q.gt("sold_count", 0).order("sold_count", { ascending: false }), limit * 4)), "bestselling");
  if (best.length >= 4) return { items: best.slice(0, limit), isBestselling: true };
  // No sales yet: show newest listings, but at most one per store so the homepage reflects the whole marketplace.
  const newest = sortListings(groupListings(await cards((q) => q.order("created_at", { ascending: false }).order("name"), 200)), "newest");
  const seen = new Set<string>();
  const diverse = newest.filter((l) => (seen.has(l.store.id) ? false : (seen.add(l.store.id), true)));
  return { items: diverse.slice(0, limit), isBestselling: false };
}

/** Cheapest longganisa offers across stores, shown in the homepage hero. */
export async function getLonggansiaOffers(limit = 4) {
  const supabase = await createClient();
  const { data: cat } = await supabase.from("categories").select("id").eq("slug", "longganisang-lucban").maybeSingle();
  if (!cat) return [];
  return cards((q) => q.eq("category_id", cat.id).order("price"), limit);
}

/** Variants of the same product in one store count as a single product (matches the cards shown). */
const listingCount = (rows: Raw[] | null | undefined) =>
  new Set((rows ?? []).map((r) => `${r.store_id}:${String(r.name).trim().toLowerCase()}`)).size;

export async function getCategories(): Promise<CategoryData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, description, image_url, sort_order, products(name, store_id)")
    .eq("products.status", "active")
    .order("sort_order");
  if (error) throw new Error(`Could not load categories: ${error.message}`);
  return (data ?? []).map((c: Raw) => ({
    id: c.id, slug: c.slug, name: c.name, description: c.description ?? null, image_url: c.image_url ?? null,
    product_count: listingCount(c.products),
  }));
}

const STORE_FIELDS =
  "id, slug, name, description, address, contact_phone, contact_email, opening_hours, logo_url, cover_url, is_open";
const toStore = (s: Raw): StoreData => ({
  id: s.id, slug: s.slug, name: s.name, description: s.description ?? null, address: s.address ?? null,
  contact_phone: s.contact_phone ?? null, contact_email: s.contact_email ?? null,
  opening_hours: s.opening_hours ?? null, logo_url: s.logo_url ?? null, cover_url: s.cover_url ?? null,
  is_open: s.is_open, product_count: listingCount(s.products),
});

export async function getStores(limit?: number): Promise<StoreData[]> {
  const supabase = await createClient();
  let query = supabase.from("stores").select(`${STORE_FIELDS}, products(name, store_id)`)
    .eq("status", "approved").eq("products.status", "active").order("name");
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load stores: ${error.message}`);
  return (data ?? []).map(toStore);
}

export async function getStoreBySlug(slug: string): Promise<StoreData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("stores").select(`${STORE_FIELDS}, products(name, store_id)`)
    .eq("slug", slug).eq("status", "approved").eq("products.status", "active").maybeSingle();
  if (error) throw new Error(`Could not load store: ${error.message}`);
  return data ? toStore(data) : null;
}

/** Categories that a given store actually sells in (for the storefront's filter). */
export async function getStoreCategories(storeId: string): Promise<Pick<CategoryData, "slug" | "name">[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("category:categories(slug, name)")
    .eq("store_id", storeId).eq("status", "active");
  if (error) throw new Error(`Could not load store categories: ${error.message}`);
  const seen = new Map<string, { slug: string; name: string }>();
  for (const row of data ?? []) {
    const c = first<Raw>((row as Raw).category);
    if (c) seen.set(c.slug, { slug: c.slug, name: c.name });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** How many active products currently have a promo price (used to decide whether to show the "on sale" banner). */
export async function getSaleCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true })
    .eq("status", "active").not("compare_at_price", "is", null);
  return count ?? 0;
}

/** Photos for the home page hero card (managed in Admin > Hero photos). Empty when none are set or the table is missing. */
export async function getHeroPhotos(): Promise<{ src: string; alt: string; href: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("hero_slides").select("image_url, alt, link_url")
    .eq("is_active", true).order("sort_order").order("created_at").limit(10);
  if (error || !data) return [];
  return data.map((r) => ({ src: r.image_url as string, alt: r.alt as string, href: r.link_url as string }));
}

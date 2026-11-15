// Shapes returned by server/queries/catalog.ts (already normalised for the UI).
export interface ProductImage { url: string; alt: string | null }

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  variant_label: string;
  price: number;
  compare_at_price: number | null; // original price when on promo (always > price)
  stock: number;
  weight: string | null;
  quantity_per_pack: string | null;
  sold_count: number;
  created_at: string;
  store: { id: string; slug: string; name: string; is_open: boolean };
  category: { slug: string; name: string } | null;
  image: ProductImage | null;
  rating: { avg: number; count: number } | null; // null when there are no real reviews
}

export interface ProductDetail extends ProductCardData {
  description: string | null;
  packaging: string | null;
  ingredients: string | null;
  storage_instructions: string | null;
  images: ProductImage[];
  store_full: {
    id: string; slug: string; name: string; address: string | null;
    contact_phone: string | null; contact_email: string | null; is_open: boolean;
  };
}

/** One card in a grid: the same product from one store, with all its variants (sizes / packs). */
export interface ProductListing {
  key: string;
  name: string;
  store: ProductCardData["store"];
  category: ProductCardData["category"];
  image: ProductImage | null;
  items: ProductCardData[];           // variants, cheapest first
  rating: ProductCardData["rating"];
  sold_count: number;
  created_at: string;
}

/** Everything the product pop-up needs. */
export interface ProductModalData {
  variants: ProductDetail[];          // this store's variants of the product, cheapest first
}

export interface CategoryData {
  id: string; slug: string; name: string; description: string | null;
  image_url: string | null; is_featured: boolean; product_count: number;
}

export interface StoreData {
  id: string; slug: string; name: string; description: string | null; address: string | null;
  contact_phone: string | null; contact_email: string | null; opening_hours: string | null;
  logo_url: string | null; cover_url: string | null; is_open: boolean;
  product_count: number;
}

export type SortKey = "newest" | "bestselling" | "price_asc" | "price_desc" | "name_asc";
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "bestselling", label: "Bestselling" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name_asc", label: "Name: A to Z" },
];

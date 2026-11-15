import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeCart, DEFAULT_SHIPPING_FEE, type CartLine } from "@/lib/utils/cart";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/** Platform default shipping fee (PHP per store). Falls back if the setting is missing. */
export async function getDefaultShippingFee(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value").eq("key", "default_shipping_fee").maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_SHIPPING_FEE;
}

/** The signed-in user's cart (RLS guarantees it is theirs), totals included. */
export async function getCart() {
  const supabase = await createClient();
  const [{ data, error }, defaultFee] = await Promise.all([
    supabase
      .from("cart_items")
      .select(
        `id, quantity, created_at,
         product:products(id, slug, name, variant_label, price, stock, weight,
           store:stores(id, slug, name, is_open, shipping_fee),
           images:product_images(url, alt, position, is_primary))`,
      )
      .order("created_at"),
    getDefaultShippingFee(),
  ]);
  if (error) throw new Error(`Could not load your cart: ${error.message}`);

  const lines: CartLine[] = (data ?? []).map((row: Raw) => {
    const p = one<Raw>(row.product);
    const s = p ? one<Raw>(p.store) : null;
    const imgs: Raw[] = p ? [...(p.images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position) : [];
    return {
      itemId: row.id, quantity: row.quantity,
      product: p && s ? {
        id: p.id, slug: p.slug, name: p.name, variant_label: p.variant_label ?? "", price: Number(p.price),
        stock: p.stock, weight: p.weight ?? null,
        image: imgs[0] ? { url: imgs[0].url, alt: imgs[0].alt ?? null } : null,
        store: { id: s.id, slug: s.slug, name: s.name, is_open: s.is_open, shipping_fee: s.shipping_fee == null ? null : Number(s.shipping_fee) },
      } : null,
    };
  });
  return { lines, ...computeCart(lines, defaultFee) };
}

/** Number of items in the cart, for the header badge. 0 for guests. */
export async function getCartCount(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return 0;
  const { data: rows } = await supabase.from("cart_items").select("quantity");
  return (rows ?? []).reduce((n, r) => n + r.quantity, 0);
}

/**
 * Price a visitor's browser-held cart. The visitor supplies ONLY {product id, quantity}; everything else
 * (price, stock, store, shipping fee) is read from the database, exactly like the logged-in cart.
 * Public product data, so it works with the anonymous key under RLS.
 */
export async function getGuestCart(items: { p: string; q: number }[]) {
  const clean = items.filter((i) => /^[0-9a-f-]{36}$/i.test(i.p) && Number.isInteger(i.q) && i.q > 0).slice(0, 50);
  const supabase = await createClient();
  const [{ data, error }, defaultFee] = await Promise.all([
    clean.length === 0
      ? Promise.resolve({ data: [] as Raw[], error: null })
      : supabase.from("products")
          .select(`id, slug, name, variant_label, price, stock, weight,
            store:stores(id, slug, name, is_open, shipping_fee),
            images:product_images(url, alt, position, is_primary)`)
          .in("id", clean.map((i) => i.p)).eq("status", "active"),
    getDefaultShippingFee(),
  ]);
  if (error) throw new Error(`Could not load your cart: ${error.message}`);
  const byId = new Map((data ?? []).map((p: Raw) => [p.id as string, p]));

  const lines: CartLine[] = clean.map((i) => {
    const p = byId.get(i.p);
    const s = p ? one<Raw>(p.store) : null;
    const imgs: Raw[] = p ? [...(p.images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position) : [];
    return {
      itemId: i.p, quantity: i.q, // for visitors the "item id" is the product id
      product: p && s ? {
        id: p.id, slug: p.slug, name: p.name, variant_label: p.variant_label ?? "", price: Number(p.price),
        stock: p.stock, weight: p.weight ?? null,
        image: imgs[0] ? { url: imgs[0].url, alt: imgs[0].alt ?? null } : null,
        store: { id: s.id, slug: s.slug, name: s.name, is_open: s.is_open, shipping_fee: s.shipping_fee == null ? null : Number(s.shipping_fee) },
      } : null,
    };
  });
  return { lines, ...computeCart(lines, defaultFee) };
}

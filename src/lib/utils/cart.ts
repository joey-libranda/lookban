// Pure cart maths and rules. No I/O, so it is unit-tested (tests/logic.test.ts).
// NOTE: these numbers are for DISPLAY. The authoritative totals are recomputed by the
// place_order() database function at checkout; the client/UI is never trusted.

export const MAX_PER_LINE = 99;
export const DEFAULT_SHIPPING_FEE = 50; // fallback if settings.default_shipping_fee is missing

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Largest quantity a customer may hold for a product. */
export const maxQuantity = (stock: number) => Math.max(0, Math.min(stock, MAX_PER_LINE));

/** Clamp a requested quantity into 1..maxQuantity(stock). Returns 0 when nothing can be bought. */
export function clampQuantity(requested: number, stock: number): number {
  const max = maxQuantity(stock);
  if (max === 0) return 0;
  if (!Number.isFinite(requested)) return 1;
  return Math.min(Math.max(Math.trunc(requested), 1), max);
}

export interface CartLine {
  itemId: string;
  quantity: number;
  /** null when the product is no longer visible (archived, store suspended, deleted). */
  product: null | {
    id: string; slug: string; name: string; variant_label: string; price: number; stock: number;
    weight: string | null; image: { url: string; alt: string | null } | null;
    store: { id: string; slug: string; name: string; is_open: boolean; shipping_fee: number | null };
  };
}

export type LineIssue = "unavailable" | "store_closed" | "out_of_stock" | "insufficient_stock";

export function lineIssue(line: CartLine): LineIssue | null {
  const p = line.product;
  if (!p) return "unavailable";
  if (!p.store.is_open) return "store_closed";
  if (p.stock <= 0) return "out_of_stock";
  if (line.quantity > p.stock) return "insufficient_stock";
  return null;
}

export function issueMessage(line: CartLine): string | null {
  const issue = lineIssue(line);
  switch (issue) {
    case "unavailable": return "This item is no longer available.";
    case "store_closed": return "This store is currently closed.";
    case "out_of_stock": return "Out of stock.";
    case "insufficient_stock": return `Only ${line.product!.stock} left - please lower the quantity.`;
    default: return null;
  }
}

export interface CartGroup {
  storeId: string; storeName: string; storeSlug: string;
  lines: CartLine[];
  subtotal: number; shippingFee: number; total: number;
}

export interface CartTotals {
  groups: CartGroup[];
  unavailable: CartLine[];       // lines whose product vanished (no store info)
  itemCount: number;
  subtotal: number; shipping: number; total: number;
  hasIssues: boolean;
}

/** Group lines by store (one shipping fee per store, like place_order()) and total everything. */
export function computeCart(lines: CartLine[], defaultFee = DEFAULT_SHIPPING_FEE): CartTotals {
  const byStore = new Map<string, CartGroup>();
  const unavailable: CartLine[] = [];

  for (const line of lines) {
    const p = line.product;
    if (!p) { unavailable.push(line); continue; }
    let g = byStore.get(p.store.id);
    if (!g) {
      g = {
        storeId: p.store.id, storeName: p.store.name, storeSlug: p.store.slug, lines: [],
        subtotal: 0, shippingFee: p.store.shipping_fee ?? defaultFee, total: 0,
      };
      byStore.set(p.store.id, g);
    }
    g.lines.push(line);
    g.subtotal = round2(g.subtotal + p.price * line.quantity);
  }

  const groups = [...byStore.values()]
    .map((g) => ({ ...g, total: round2(g.subtotal + g.shippingFee) }))
    .sort((a, b) => a.storeName.localeCompare(b.storeName));

  const subtotal = round2(groups.reduce((s, g) => s + g.subtotal, 0));
  const shipping = round2(groups.reduce((s, g) => s + g.shippingFee, 0));
  return {
    groups, unavailable,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal, shipping, total: round2(subtotal + shipping),
    hasIssues: unavailable.length > 0 || lines.some((l) => lineIssue(l) !== null),
  };
}

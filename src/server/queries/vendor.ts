import "server-only";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/commission-periods";
import type { FulfillmentStatus, PaymentMethod, PaymentStatus } from "@/types/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
export const VENDOR_PAGE_SIZE = 15;
const round = (n: number) => Math.round(n * 100) / 100;

export type VendorOrderRow = {
  id: string; order_id: string; status: FulfillmentStatus; subtotal: number; shipping_fee: number; total: number; created_at: string;
  receipt_no: string; customer_name: string; payment_method: PaymentMethod; payment_status: PaymentStatus;
};

const ORDER_SELECT = "id, order_id, fulfillment_status, subtotal, shipping_fee, total, created_at, order:orders(receipt_no, customer_name, payment_method, payment_status)";
const mapOrder = (r: Raw): VendorOrderRow => {
  const o = first<Raw>(r.order);
  return {
    id: r.id, order_id: r.order_id, status: r.fulfillment_status, subtotal: Number(r.subtotal), shipping_fee: Number(r.shipping_fee), total: Number(r.total),
    created_at: r.created_at, receipt_no: o?.receipt_no ?? "", customer_name: o?.customer_name ?? "", payment_method: o?.payment_method, payment_status: o?.payment_status,
  };
};

/** Everything the vendor dashboard shows. All queries run as the vendor, so RLS limits them to their own store. */
export async function getVendorDashboard(storeId: string) {
  const supabase = await createClient();
  const month = resolvePeriod("month");
  const [orders, recent, commissions, products, low] = await Promise.all([
    supabase.from("store_orders").select("fulfillment_status, subtotal").eq("store_id", storeId).limit(10000),
    supabase.from("store_orders").select(ORDER_SELECT).eq("store_id", storeId).order("created_at", { ascending: false }).limit(6),
    supabase.from("store_order_commissions").select("amount, earned_at, so:store_orders(subtotal)").eq("store_id", storeId).not("amount", "is", null).limit(10000),
    supabase.from("products").select("status, approval_status").eq("store_id", storeId).limit(5000),
    supabase.from("products").select("id, name, variant_label, stock").eq("store_id", storeId).eq("status", "active").lte("stock", 10).order("stock").limit(6),
  ]);
  const so = (orders.data ?? []) as Raw[];
  const count = (st: FulfillmentStatus[]) => so.filter((o) => st.includes(o.fulfillment_status)).length;
  let allSales = 0, allCommission = 0, monthSales = 0, monthCommission = 0;
  for (const c of (commissions.data ?? []) as Raw[]) {
    const sales = Number(first<Raw>(c.so)?.subtotal ?? 0), amt = Number(c.amount);
    allSales += sales; allCommission += amt;
    if (month.from && month.to && c.earned_at >= month.from && c.earned_at < month.to) { monthSales += sales; monthCommission += amt; }
  }
  const prods = (products.data ?? []) as Raw[];
  return {
    toHandle: count(["pending", "confirmed", "preparing"]), outForDelivery: count(["out_for_delivery"]), delivered: count(["delivered"]),
    all: { sales: round(allSales), commission: round(allCommission), owed: round(allSales - allCommission) },
    month: { label: month.label, sales: round(monthSales), commission: round(monthCommission), owed: round(monthSales - monthCommission) },
    activeProducts: prods.filter((p) => p.status === "active").length,
    pendingProducts: prods.filter((p) => p.approval_status === "pending").length,
    rejectedProducts: prods.filter((p) => p.approval_status === "rejected").length,
    recent: ((recent.data ?? []) as Raw[]).map(mapOrder),
    lowStock: ((low.data ?? []) as Raw[]).map((p) => ({ id: p.id as string, name: p.name as string, variant: (p.variant_label ?? "") as string, stock: p.stock as number })),
  };
}

export async function getVendorOrders(storeId: string, opts: { status?: string; page: number }) {
  const supabase = await createClient();
  let q = supabase.from("store_orders").select(ORDER_SELECT, { count: "exact" }).eq("store_id", storeId);
  if (opts.status) q = q.eq("fulfillment_status", opts.status);
  const from = (opts.page - 1) * VENDOR_PAGE_SIZE;
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, from + VENDOR_PAGE_SIZE - 1);
  if (error) throw new Error(`Could not load orders: ${error.message}`);
  return { count: count ?? 0, rows: ((data ?? []) as Raw[]).map(mapOrder) };
}

export async function getVendorProducts(storeId: string, opts: { q?: string; status?: string; page: number }) {
  const supabase = await createClient();
  let q = supabase.from("products")
    .select("id, name, variant_label, price, stock, status, approval_status, review_note, images:product_images(url, is_primary)", { count: "exact" })
    .eq("store_id", storeId);
  const term = (opts.q ?? "").replace(/[%_,()\\]/g, " ").trim().slice(0, 60);
  if (term) q = q.or(`name.ilike.%${term}%,variant_label.ilike.%${term}%`);
  if (opts.status === "active" || opts.status === "archived") q = q.eq("status", opts.status).eq("approval_status", "approved");
  if (opts.status === "pending" || opts.status === "rejected") q = q.eq("approval_status", opts.status);
  if (opts.status === "low") q = q.lte("stock", 10).eq("status", "active");
  const from = (opts.page - 1) * VENDOR_PAGE_SIZE;
  const { data, count, error } = await q.order("name").range(from, from + VENDOR_PAGE_SIZE - 1);
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return {
    count: count ?? 0,
    rows: ((data ?? []) as Raw[]).map((p) => ({
      id: p.id as string, name: p.name as string, variant: (p.variant_label ?? "") as string, price: Number(p.price), stock: p.stock as number,
      status: p.status as "active" | "archived", approval: p.approval_status as "approved" | "pending" | "rejected", note: (p.review_note ?? null) as string | null,
      image: ((p.images ?? []) as Raw[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]?.url as string | undefined,
    })),
  };
}

/** One product of the vendor's own store (the shop is public, so we check the store explicitly). */
export async function getVendorProduct(storeId: string, id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*, images:product_images(id, url, alt, position, is_primary)").eq("id", id).eq("store_id", storeId).maybeSingle();
  if (!data) return null;
  const images = ([...(data.images ?? [])] as Raw[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position);
  return { ...(data as Raw), images } as Raw & { images: { id: string; url: string; alt: string | null; is_primary: boolean }[] };
}

/** Commission row of one store order of this store (rate + amount, amount null until delivered). */
export async function getVendorCommissions(storeOrderIds: string[]) {
  const supabase = await createClient();
  const { data } = await supabase.from("store_order_commissions").select("store_order_id, rate, amount").in("store_order_id", storeOrderIds);
  return new Map(((data ?? []) as Raw[]).map((c) => [c.store_order_id as string, { rate: Number(c.rate), amount: c.amount === null ? null : Number(c.amount) }]));
}

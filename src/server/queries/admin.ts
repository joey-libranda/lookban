import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Period } from "@/lib/commission-periods";
import type { FulfillmentStatus, PaymentMethod, PaymentStatus } from "@/types/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export const ADMIN_PAGE_SIZE = 20;
/** Escape characters that have meaning inside PostgREST `or()` filters / ILIKE patterns. */
export const safeLike = (q: string) => q.replace(/[%_,()\\]/g, " ").trim().slice(0, 60);

export async function getDashboard() {
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [customers, stores, products, orders, sales, recent, low] = await Promise.all([
    supabase.from("profiles").select("id", head).eq("role", "customer"),
    supabase.from("stores").select("id", head),
    supabase.from("products").select("id", head).eq("status", "active"),
    supabase.from("orders").select("id", head),
    supabase.from("orders").select("total, status, payment_method, payment_status").limit(10000),
    supabase.from("orders").select("id, receipt_no, created_at, customer_name, total, status, payment_method, payment_status")
      .order("created_at", { ascending: false }).limit(8),
    supabase.from("products").select("id, name, variant_label, stock, store:stores(name)").eq("status", "active")
      .lte("stock", 10).order("stock").limit(8),
  ]);
  const rows = (sales.data ?? []) as Raw[];
  const live = rows.filter((o) => o.status !== "cancelled"); // cancelled orders are not sales
  const sum = (xs: Raw[]) => xs.reduce((n, o) => n + Number(o.total), 0);
  return {
    customers: customers.count ?? 0, stores: stores.count ?? 0, products: products.count ?? 0, orders: orders.count ?? 0,
    salesTotal: sum(live), salesCod: sum(live.filter((o) => o.payment_method === "cod")),
    salesSimulated: sum(live.filter((o) => o.payment_method === "simulated_online")),
    activeOrders: live.filter((o) => o.status !== "delivered").length,
    deliveredTotal: sum(live.filter((o) => o.status === "delivered")),
    recent: (recent.data ?? []).map((o: Raw) => ({ ...o, total: Number(o.total) })) as {
      id: string; receipt_no: string; created_at: string; customer_name: string; total: number; status: FulfillmentStatus;
      payment_method: PaymentMethod; payment_status: PaymentStatus;
    }[],
    lowStock: (low.data ?? []).map((p: Raw) => ({ id: p.id as string, name: p.name as string, variant: (p.variant_label ?? "") as string,
      stock: p.stock as number, store: first<Raw>(p.store)?.name as string | undefined })),
  };
}

export async function getAdminStoreOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("stores").select("id, name").order("name");
  return (data ?? []) as { id: string; name: string }[];
}

export async function getAdminCategoryOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name, slug, description, sort_order").order("sort_order").order("name");
  return (data ?? []) as { id: string; name: string; slug: string; description: string | null; sort_order: number }[];
}

export async function getAdminProducts(opts: { q?: string; store?: string; status?: string; page: number }) {
  const supabase = await createClient();
  let q = supabase.from("products")
    .select("id, name, variant_label, price, stock, status, approval_status, store:stores(id, name), images:product_images(url, is_primary)", { count: "exact" });
  const term = opts.q ? safeLike(opts.q) : "";
  if (term) q = q.or(`name.ilike.%${term}%,variant_label.ilike.%${term}%`);
  if (opts.store) q = q.eq("store_id", opts.store);
  if (opts.status === "active" || opts.status === "archived") q = q.eq("status", opts.status);
  if (opts.status === "pending" || opts.status === "rejected") q = q.eq("approval_status", opts.status);
  if (opts.status === "low") q = q.lte("stock", 10).eq("status", "active");
  const from = (opts.page - 1) * ADMIN_PAGE_SIZE;
  const { data, count, error } = await q.order("name").range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return {
    count: count ?? 0,
    rows: (data ?? []).map((p: Raw) => ({
      id: p.id as string, name: p.name as string, variant: (p.variant_label ?? "") as string, price: Number(p.price), stock: p.stock as number,
      status: p.status as "active" | "archived", approval: (p.approval_status ?? "approved") as "approved" | "pending" | "rejected", store: first<Raw>(p.store)?.name as string | undefined,
      image: ((p.images ?? []) as Raw[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]?.url as string | undefined,
    })),
  };
}

export async function getAdminProduct(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*, images:product_images(id, url, alt, position, is_primary)").eq("id", id).maybeSingle();
  if (!data) return null;
  const images = ([...(data.images ?? [])] as Raw[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position);
  return { ...(data as Raw), images } as Raw & { images: { id: string; url: string; alt: string | null; is_primary: boolean }[] };
}

export async function getAdminStores() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("stores")
    .select("id, name, slug, status, is_open, address, shipping_fee, owner:profiles!owner_id(email), products(count)").order("name");
  if (error) throw new Error(`Could not load stores: ${error.message}`);
  return (data ?? []).map((s: Raw) => ({ ...s, vendor_email: (first<Raw>(s.owner)?.email ?? null) as string | null, product_count: (s.products?.[0]?.count ?? 0) as number })) as
    { vendor_email: string | null; id: string; name: string; slug: string; status: string; is_open: boolean; address: string | null; shipping_fee: number | null; product_count: number }[];
}

export async function getAdminStore(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("stores").select("*").eq("id", id).maybeSingle();
  return data as Raw | null;
}

export async function getAdminOrders(opts: { q?: string; status?: string; page: number }) {
  const supabase = await createClient();
  let q = supabase.from("orders")
    .select("id, receipt_no, created_at, customer_name, customer_phone, total, status, payment_method, payment_status, store_orders(id)", { count: "exact" });
  const term = opts.q ? safeLike(opts.q) : "";
  if (term) q = q.or(`receipt_no.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`);
  if (opts.status) q = q.eq("status", opts.status);
  const from = (opts.page - 1) * ADMIN_PAGE_SIZE;
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) throw new Error(`Could not load orders: ${error.message}`);
  return {
    count: count ?? 0,
    rows: (data ?? []).map((o: Raw) => ({ ...o, total: Number(o.total), store_count: (o.store_orders ?? []).length })) as {
      id: string; receipt_no: string; created_at: string; customer_name: string; customer_phone: string; total: number;
      status: FulfillmentStatus; payment_method: PaymentMethod; payment_status: PaymentStatus; store_count: number;
    }[],
  };
}

export async function getAdminCustomers(opts: { q?: string; page: number }) {
  const supabase = await createClient();
  let q = supabase.from("profiles").select("id, email, full_name, phone, is_active, created_at", { count: "exact" }).eq("role", "customer");
  const term = opts.q ? safeLike(opts.q) : "";
  if (term) q = q.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  const from = (opts.page - 1) * ADMIN_PAGE_SIZE;
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) throw new Error(`Could not load customers: ${error.message}`);
  return { count: count ?? 0, rows: (data ?? []) as { id: string; email: string | null; full_name: string | null; phone: string | null; is_active: boolean; created_at: string }[] };
}

export async function getShippingFeeSetting() {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value").eq("key", "default_shipping_fee").maybeSingle();
  return Number(data?.value ?? 50);
}

export async function getCommissionRateSetting() {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value").eq("key", "default_commission_rate").maybeSingle();
  return Number(data?.value ?? 5);
}

export async function getAdminMessages() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contact_messages")
    .select("id, name, email, subject, message, status, created_at, replies:contact_replies(id)").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(`Could not load messages: ${error.message}`);
  return ((data ?? []) as Raw[]).map((m) => ({ ...m, reply_count: (m.replies ?? []).length })) as {
    id: string; name: string; email: string; subject: string; message: string; status: "new" | "read"; created_at: string; reply_count: number }[];
}

export type MessageReply = { id: string; body: string; created_at: string };
export async function getAdminMessage(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("contact_messages")
    .select("id, name, email, subject, message, status, created_at, replies:contact_replies(id, body, created_at)").eq("id", id).maybeSingle();
  if (!data) return null;
  const m = data as Raw;
  const replies = ([...(m.replies ?? [])] as MessageReply[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { id: m.id as string, name: m.name as string, email: m.email as string, subject: m.subject as string, message: m.message as string,
    status: m.status as "new" | "read", created_at: m.created_at as string, replies };
}

export type HeroSlideRow = { id: string; image_url: string; alt: string; link_url: string; sort_order: number; is_active: boolean };

export async function getAdminHeroSlides() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("hero_slides").select("id, image_url, alt, link_url, sort_order, is_active")
    .order("sort_order").order("created_at");
  if (error) throw new Error(`Could not load hero photos: ${error.message}`);
  return (data ?? []) as HeroSlideRow[];
}

// ---------------------------------------------------------------- commission report
export type CommissionLine = { store_order_id: string; receipt_no: string; earned_at: string; sales: number; rate: number; commission: number };
export type CommissionStore = { store_id: string; store_name: string; orders: number; sales: number; commission: number; owed: number; lines: CommissionLine[] };

/** Earned commissions (delivered store orders only), grouped by store, for one period. */
export async function getCommissionReport(period: Period, storeId?: string): Promise<CommissionStore[]> {
  const supabase = await createClient();
  let q = supabase.from("store_order_commissions")
    .select("store_order_id, store_id, rate, amount, earned_at, store:stores(name), so:store_orders(subtotal, order:orders(receipt_no))")
    .not("amount", "is", null).order("earned_at", { ascending: true }).limit(10000);
  if (period.from && period.to) q = q.gte("earned_at", period.from).lt("earned_at", period.to);
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q;
  if (error) throw new Error(`Could not load commissions: ${error.message}`);
  const by = new Map<string, CommissionStore>();
  for (const c of (data ?? []) as Raw[]) {
    const so = first<Raw>(c.so); const order = first<Raw>(so?.order); const store = first<Raw>(c.store);
    const row: CommissionStore = by.get(c.store_id) ?? { store_id: c.store_id, store_name: store?.name ?? "Store", orders: 0, sales: 0, commission: 0, owed: 0, lines: [] };
    const sales = Number(so?.subtotal ?? 0), commission = Number(c.amount);
    row.orders += 1; row.sales += sales; row.commission += commission;
    row.lines.push({ store_order_id: c.store_order_id, receipt_no: order?.receipt_no ?? "", earned_at: c.earned_at, sales, rate: Number(c.rate), commission });
    by.set(c.store_id, row);
  }
  const rows = [...by.values()];
  for (const r2 of rows) {
    r2.sales = Math.round(r2.sales * 100) / 100; r2.commission = Math.round(r2.commission * 100) / 100;
    r2.owed = Math.round((r2.sales - r2.commission) * 100) / 100;
  }
  return rows.sort((a, b) => b.sales - a.sales);
}

/** Commission rows for one order (admin order page): store_order_id -> { rate, amount|null }. */
export async function getOrderCommissions(storeOrderIds: string[]) {
  const supabase = await createClient();
  const { data } = await supabase.from("store_order_commissions").select("store_order_id, rate, amount").in("store_order_id", storeOrderIds);
  return new Map(((data ?? []) as Raw[]).map((c) => [c.store_order_id as string, { rate: Number(c.rate), amount: c.amount === null ? null : Number(c.amount) }]));
}

/** Products waiting for an admin decision (shown as a badge in the admin menu). */
export async function getPendingProductCount() {
  const supabase = await createClient();
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("approval_status", "pending");
  return count ?? 0;
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OrderRow } from "@/types/orders";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

/**
 * One order with its per-store sub-orders and the price-at-purchase item snapshots.
 * RLS decides visibility: customers see their own orders, vendors only their store's part, admins all.
 */
export async function getOrder(id: string): Promise<OrderRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, receipt_no, created_at, customer_name, customer_phone, customer_email,
       delivery_line1, delivery_barangay, delivery_city, delivery_province, delivery_postal, notes,
       payment_method, payment_status, status, subtotal, shipping_total, total,
       store_orders(id, store_id, store_name, subtotal, shipping_fee, total, fulfillment_status, received_at, rating, rating_comment, rated_at,
         store:stores(slug, address, contact_phone),
         order_items(id, product_id, product_name, variant_label, price_at_purchase, quantity, line_total))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load order: ${error.message}`);
  if (!data) return null;
  return normalizeOrder(data as Raw);
}

/**
 * A guest (or anyone holding the tracking link) reads ONE order via its secret token.
 * Goes through get_order_by_token(); anonymous users have no direct SELECT on orders.
 */
export async function getOrderByToken(id: string, token: string): Promise<OrderRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_order_by_token", { p_id: id, p_token: token });
  if (error) throw new Error(`Could not load order: ${error.message}`);
  return data ? normalizeOrder(data as Raw) : null;
}

function normalizeOrder(data: Raw): OrderRow {
  const num = (v: unknown) => Number(v);
  return {
    ...(data as Raw),
    subtotal: num(data.subtotal), shipping_total: num(data.shipping_total), total: num(data.total),
    store_orders: ((data.store_orders ?? []) as Raw[])
      .map((so) => ({
        id: so.id, store_id: so.store_id, store_name: so.store_name,
        store_slug: (Array.isArray(so.store) ? so.store[0] : so.store)?.slug ?? null,
        store_address: (Array.isArray(so.store) ? so.store[0] : so.store)?.address ?? null,
        store_phone: (Array.isArray(so.store) ? so.store[0] : so.store)?.contact_phone ?? null,
        subtotal: num(so.subtotal), shipping_fee: num(so.shipping_fee), total: num(so.total),
        fulfillment_status: so.fulfillment_status,
        received_at: so.received_at ?? null, rating: so.rating ?? null, rating_comment: so.rating_comment ?? null, rated_at: so.rated_at ?? null,
        items: ((so.order_items ?? []) as Raw[]).map((i) => ({
          id: i.id, product_id: i.product_id, product_name: i.product_name, variant_label: i.variant_label ?? "",
          price_at_purchase: num(i.price_at_purchase), quantity: i.quantity, line_total: num(i.line_total),
        })),
      }))
      .sort((a, b) => a.store_name.localeCompare(b.store_name)),
  } as OrderRow;
}

/** The customer's saved default address (if any), used to prefill checkout. */
export async function getDefaultAddress() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("addresses")
    .select("recipient_name, phone, line1, barangay, city, province, postal_code")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** The signed-in customer's orders, newest first (RLS limits rows to their own). */
export async function getMyOrders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, receipt_no, created_at, total, status, payment_method, payment_status, store_orders(id)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load orders: ${error.message}`);
  return (data ?? []).map((o: Raw) => ({
    id: o.id as string, receipt_no: o.receipt_no as string, created_at: o.created_at as string,
    total: Number(o.total), status: o.status as OrderRow["status"],
    payment_method: o.payment_method as OrderRow["payment_method"], payment_status: o.payment_status as OrderRow["payment_status"],
    store_count: (o.store_orders ?? []).length as number,
  }));
}

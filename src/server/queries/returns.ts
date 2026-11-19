import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ReturnReason, ReturnStatus } from "@/lib/returns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export interface ReturnSummary {
  id: string; status: ReturnStatus; reason: ReturnReason; desired: "refund" | "replacement"; resolution: "refund" | "replacement" | null;
  refund_amount: number; created_at: string; updated_at: string; store_order_id: string;
  store_name: string; order_id: string; receipt_no: string; customer_name: string;
}
export interface ReturnDetail extends ReturnSummary {
  details: string; items_refund: number; shipping_refund: number; store_note: string | null; admin_note: string | null;
  refund_reference: string | null; escalated_at: string | null; store_id: string | null; shipping_fee: number; paid_online: boolean;
  items: { id: string; product_name: string; variant_label: string; quantity: number; unit_price: number; line_refund: number }[];
  photos: { id: string; url: string | null }[];
  events: { id: string; actor_role: "customer" | "store" | "admin"; event: string; note: string | null; created_at: string }[];
}

const SUMMARY = `id, status, reason, desired, resolution, refund_amount, created_at, updated_at, store_order_id,
  store_order:store_orders!store_order_id(store_name, order_id, shipping_fee, order:orders!order_id(receipt_no, customer_name, payment_method))`;

function summarize(r: Raw): ReturnSummary {
  const so = one<Raw>(r.store_order); const o = one<Raw>(so?.order);
  return {
    id: r.id, status: r.status, reason: r.reason, desired: r.desired, resolution: r.resolution, refund_amount: Number(r.refund_amount),
    created_at: r.created_at, updated_at: r.updated_at, store_order_id: r.store_order_id,
    store_name: so?.store_name ?? "Store", order_id: so?.order_id ?? "", receipt_no: o?.receipt_no ?? "", customer_name: o?.customer_name ?? "",
  };
}

/** RLS decides what the caller sees: own requests (customer), their store's (vendor) or all (admin). */
export async function listReturns(statuses?: ReturnStatus[]): Promise<ReturnSummary[]> {
  const supabase = await createClient();
  let q = supabase.from("return_requests").select(SUMMARY).order("created_at", { ascending: false }).limit(200);
  if (statuses?.length) q = q.in("status", statuses);
  const { data, error } = await q;
  if (error) throw new Error(`Could not load returns: ${error.message}`);
  return ((data ?? []) as Raw[]).map(summarize);
}

export async function countReturns(statuses: ReturnStatus[]): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("return_requests").select("id", { count: "exact", head: true }).in("status", statuses);
  return count ?? 0;
}

export async function getReturn(id: string): Promise<ReturnDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("return_requests")
    .select(`${SUMMARY}, details, items_refund, shipping_refund, store_note, admin_note, refund_reference, escalated_at, store_id,
      return_request_items(id, product_name, variant_label, quantity, unit_price, line_refund),
      return_request_photos(id, path),
      return_request_events(id, actor_role, event, note, created_at)`)
    .eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the return: ${error.message}`);
  if (!data) return null;
  const r = data as Raw; const so = one<Raw>(r.store_order); const o = one<Raw>(so?.order);
  const photos = await Promise.all(((r.return_request_photos ?? []) as Raw[]).map(async (p) => {
    const { data: s } = await supabase.storage.from("return-evidence").createSignedUrl(p.path, 600); // 10 minutes
    return { id: p.id as string, url: s?.signedUrl ?? null };
  }));
  return {
    ...summarize(r),
    details: r.details, items_refund: Number(r.items_refund), shipping_refund: Number(r.shipping_refund),
    store_note: r.store_note, admin_note: r.admin_note, refund_reference: r.refund_reference, escalated_at: r.escalated_at,
    store_id: r.store_id, shipping_fee: Number(so?.shipping_fee ?? 0), paid_online: o?.payment_method !== "cod",
    items: ((r.return_request_items ?? []) as Raw[]).map((i) => ({ ...i, unit_price: Number(i.unit_price), line_refund: Number(i.line_refund) })) as ReturnDetail["items"],
    photos,
    events: ((r.return_request_events ?? []) as ReturnDetail["events"]).sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

/** Return requests for the store orders of ONE order (customer's order page). */
export async function getReturnsForStoreOrders(ids: string[]) {
  if (!ids.length) return new Map<string, { id: string; status: ReturnStatus }>();
  const supabase = await createClient();
  const { data } = await supabase.from("return_requests").select("id, status, store_order_id, created_at").in("store_order_id", ids).order("created_at", { ascending: false });
  const m = new Map<string, { id: string; status: ReturnStatus }>();
  for (const r of (data ?? []) as Raw[]) if (!m.has(r.store_order_id)) m.set(r.store_order_id, { id: r.id, status: r.status });
  return m;
}

/** When the customer's return window for a delivered store order closes (null = not eligible). */
export async function getReturnDeadline(storeOrderId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("return_deadline", { p_store_order_id: storeOrderId });
  return (data as string | null) ?? null;
}

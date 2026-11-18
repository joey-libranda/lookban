import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Small counters for the My Account overview. Every query runs as the signed-in user, so RLS limits the rows. */
export async function getCustomerOverview() {
  const supabase = await createClient();
  const [toReceive, toRate] = await Promise.all([
    supabase.from("store_orders").select("id", { count: "exact", head: true }).eq("fulfillment_status", "out_for_delivery"),
    supabase.from("store_orders").select("id", { count: "exact", head: true }).eq("fulfillment_status", "delivered").is("rating", null),
  ]);
  return { toReceive: toReceive.count ?? 0, toRate: toRate.count ?? 0 };
}

export async function getAdminOverview() {
  const supabase = await createClient();
  const [newOrders, messages] = await Promise.all([
    supabase.from("store_orders").select("id", { count: "exact", head: true }).eq("fulfillment_status", "pending"),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  return { newOrders: newOrders.count ?? 0, unreadMessages: messages.count ?? 0 };
}

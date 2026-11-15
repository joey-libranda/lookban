"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type OrderActionResult = { ok: true; message: string } | { ok: false; error: string };

const id = z.string().uuid();
const rating = z.object({
  rating: z.number().int().min(1, "Choose a rating from 1 to 5 stars.").max(5, "Choose a rating from 1 to 5 stars."),
  comment: z.string().trim().max(1000, "Feedback is too long (1000 characters max).").optional(),
});

/** Database errors look like "CODE:Readable text". Show only the readable part. */
const clean = (msg: string | undefined, fallback: string) => msg?.replace(/^[A-Z_]+:\s*/, "").trim() || fallback;

function refresh(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/account/orders");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

/**
 * Cancel one store's part of an order. Allowed only before it is out for delivery.
 * Signed-in customers pass nothing else; guests pass the secret tracking token from their link.
 * The database function re-checks ownership/token and status, restocks, and recalculates the total.
 */
export async function cancelStoreOrderAction(orderId: string, storeOrderId: string, token?: string): Promise<OrderActionResult> {
  if (!id.safeParse(orderId).success || !id.safeParse(storeOrderId).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { error } = token && id.safeParse(token).success
    ? await supabase.rpc("cancel_store_order_by_token", { p_order_id: orderId, p_token: token, p_store_order_id: storeOrderId })
    : await supabase.rpc("cancel_my_store_order", { p_store_order_id: storeOrderId });
  if (error) return { ok: false, error: clean(error.message, "Could not cancel this order.") };
  refresh(orderId);
  return { ok: true, message: "Order cancelled." };
}

/** Customer confirms the parcel arrived (only possible while it is out for delivery). */
export async function confirmReceivedAction(orderId: string, storeOrderId: string, token?: string): Promise<OrderActionResult> {
  if (!id.safeParse(orderId).success || !id.safeParse(storeOrderId).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { error } = token && id.safeParse(token).success
    ? await supabase.rpc("confirm_store_order_received_by_token", { p_order_id: orderId, p_token: token, p_store_order_id: storeOrderId })
    : await supabase.rpc("confirm_my_store_order_received", { p_store_order_id: storeOrderId });
  if (error) return { ok: false, error: clean(error.message, "Could not confirm delivery.") };
  refresh(orderId);
  return { ok: true, message: "Thank you for confirming!" };
}

/** Signed-in customers only. 1-5 stars, optional feedback, once per delivered store order. */
export async function rateStoreOrderAction(orderId: string, storeOrderId: string, stars: number, comment?: string): Promise<OrderActionResult> {
  if (!id.safeParse(orderId).success || !id.safeParse(storeOrderId).success) return { ok: false, error: "Invalid request." };
  const p = rating.safeParse({ rating: stars, comment });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("rate_my_store_order", {
    p_store_order_id: storeOrderId, p_rating: p.data.rating, p_comment: p.data.comment || null,
  });
  if (error) return { ok: false, error: clean(error.message, "Could not save your rating.") };
  refresh(orderId);
  revalidatePath("/shop");
  return { ok: true, message: "Thanks for your rating!" };
}

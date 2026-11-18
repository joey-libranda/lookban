"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { clampQuantity, MAX_PER_LINE, type CartLine, type CartTotals } from "@/lib/utils/cart";
import { friendlyOrderError } from "@/lib/utils/order-errors";
import { guestCheckoutSchema, type GuestCheckoutValues } from "@/lib/validators/checkout";
import { getGuestCart } from "@/server/queries/cart";
import { addToCartAction } from "@/server/actions/cart";

const itemsSchema = z.array(z.object({ p: z.string().uuid(), q: z.number().int().min(1).max(MAX_PER_LINE) })).max(50);
export type GuestCartData = { lines: CartLine[] } & CartTotals;

/** Price a visitor's cart (server-side prices). */
export async function guestCartAction(items: unknown): Promise<{ ok: true; cart: GuestCartData } | { ok: false; error: string }> {
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: "Your cart could not be read. Please add the items again." };
  try {
    return { ok: true, cart: await getGuestCart(parsed.data) };
  } catch {
    return { ok: false, error: "Could not load your cart. Please try again." };
  }
}

/**
 * Add-to-cart check for visitors: is the product buyable, and how many can they hold? The browser keeps the
 * cart; this only validates and clamps to current stock.
 */
export async function guestAddCheckAction(productId: string, wanted: number, have: number):
  Promise<{ ok: true; quantity: number; capped: boolean; name: string } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(productId).success || !Number.isInteger(wanted) || wanted < 1 || !Number.isInteger(have) || have < 0) {
    return { ok: false, error: "Invalid request." };
  }
  const supabase = await createClient();
  const { data: product } = await supabase.from("products")
    .select("id, name, stock, status, store:stores(is_open, status)").eq("id", productId).maybeSingle();
  const store = Array.isArray(product?.store) ? product?.store[0] : product?.store;
  if (!product || product.status !== "active" || !store || store.status !== "approved") return { ok: false, error: "Sorry, this product is no longer available." };
  if (!store.is_open) return { ok: false, error: "This store is currently closed." };
  if (product.stock <= 0) return { ok: false, error: "This product is out of stock." };
  const target = clampQuantity(have + wanted, product.stock);
  if (target <= have) return { ok: false, error: `You already have all ${product.stock} available in your cart.` };
  return { ok: true, quantity: target, capped: have + wanted > target, name: product.name };
}

/** After login: move the browser cart into the saved cart. Reuses the normal add-to-cart rules. */
export async function mergeGuestCartAction(items: unknown): Promise<{ merged: number; failed: number }> {
  const current = await getCurrentUser();
  const parsed = itemsSchema.safeParse(items);
  if (!current || current.profile.role !== "customer" || !parsed.success) return { merged: 0, failed: 0 };
  let merged = 0, failed = 0;
  for (const i of parsed.data) {
    try {
      const r = await addToCartAction(i.p, i.q); // items that are no longer buyable are simply skipped
      if (r.ok) merged++;
    } catch { failed++; /* a transient error must not stop the rest, and keeps the browser cart for a retry */ }
  }
  return { merged, failed };
}

export type GuestOrderResult = { ok: true; redirectTo: string } | { ok: false; error: string; fixInCart?: boolean };

/**
 * Guest checkout. The visitor sends delivery details + {product id, quantity} pairs only.
 * place_guest_order() prices everything from the database in one transaction.
 */
export async function placeGuestOrderAction(values: GuestCheckoutValues, items: unknown): Promise<GuestOrderResult> {
  const v = guestCheckoutSchema.safeParse(values);
  if (!v.success) return { ok: false, error: v.error.issues[0].message };
  const it = itemsSchema.safeParse(items);
  if (!it.success || it.data.length === 0) return { ok: false, error: "Your cart is empty.", fixInCart: true };
  const d = v.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_guest_order", {
    p_items: it.data.map((i) => ({ product_id: i.p, quantity: i.q })), p_email: d.email || null,
    p_name: d.full_name, p_phone: d.phone, p_line1: d.line1, p_barangay: d.barangay || null,
    p_city: d.city, p_province: d.province, p_postal: d.postal || null, p_notes: d.notes || null,
    p_payment_method: d.payment_method,
  });
  const res = data as { id?: string; token?: string } | null;
  if (error || !res?.id || !res?.token) {
    const f = friendlyOrderError(error?.message);
    return { ok: false, error: f.text, fixInCart: f.fixInCart };
  }
  return { ok: true, redirectTo: `/orders/${res.id}?t=${res.token}&placed=1` };
}

const trackSchema = z.object({ receipt: z.string().trim().min(5, "Enter your receipt number").max(40), phone: z.string().trim().min(10, "Enter the mobile number used at checkout").max(20) });

/** "Where is my order?" - receipt number + phone used at checkout. Deliberately vague on failure. */
export async function trackOrderAction(_prev: { error?: string } | null, fd: FormData): Promise<{ error?: string }> {
  const p = trackSchema.safeParse({ receipt: fd.get("receipt"), phone: fd.get("phone") });
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const { data } = await supabase.rpc("track_order", { p_receipt: p.data.receipt, p_phone: p.data.phone });
  const res = data as { id?: string; token?: string } | null;
  if (!res?.id) return { error: "We couldn't find an order with those details. Check the receipt number and mobile number." };
  redirect(`/orders/${res.id}?t=${res.token}`);
}

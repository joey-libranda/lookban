"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyOrderError } from "@/lib/utils/order-errors";
import { checkoutSchema, type CheckoutValues } from "@/lib/validators/checkout";
import { createClient } from "@/lib/supabase/server";

export type PlaceOrderResult = { ok: false; error: string; fixInCart?: boolean; needsLogin?: boolean };

/**
 * Creates the order. The client sends ONLY delivery details + payment method.
 * Prices, quantities, stock checks, shipping, vendor split and payment status all come from the
 * database inside place_order() (one transaction), so nothing money-related can be tampered with.
 */
export async function placeOrderAction(values: CheckoutValues): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please log in to place your order.", needsLogin: true };

  const { data: orderId, error } = await supabase.rpc("place_order", {
    p_name: v.full_name, p_phone: v.phone, p_line1: v.line1, p_barangay: v.barangay || null,
    p_city: v.city, p_province: v.province, p_postal: v.postal || null, p_notes: v.notes || null,
    p_payment_method: v.payment_method,
  });
  if (error || !orderId) {
    const f = friendlyOrderError(error?.message);
    return { ok: false, error: f.text, fixInCart: f.fixInCart };
  }

  revalidatePath("/cart");
  revalidatePath("/", "layout");
  redirect(`/orders/${orderId}?placed=1`);
}

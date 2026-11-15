"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { clampQuantity, MAX_PER_LINE } from "@/lib/utils/cart";

export type CartResult =
  | { ok: true; message: string; count: number }
  | { ok: false; error: string; needsLogin?: boolean };

const idSchema = z.string().uuid();
const qtySchema = z.number().int().min(1).max(MAX_PER_LINE);

type Supa = Awaited<ReturnType<typeof createClient>>;

async function currentUserId(supabase: Supa) {
  const { data } = await supabase.auth.getUser(); // verified with Supabase Auth, not just the cookie
  return data.user?.id ?? null;
}

/** Get (or lazily create) the user's single cart. */
async function ensureCart(supabase: Supa, userId: string): Promise<string> {
  const { data: existing } = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase.from("carts").insert({ user_id: userId }).select("id").single();
  if (created) return created.id;
  // Lost a race with another request that created it first.
  const { data: again } = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
  if (again) return again.id;
  throw new Error(error?.message ?? "Could not create cart");
}

async function cartCount(supabase: Supa) {
  const { data } = await supabase.from("cart_items").select("quantity");
  return (data ?? []).reduce((n, r) => n + r.quantity, 0);
}

const refresh = () => { revalidatePath("/cart"); revalidatePath("/", "layout"); };

export async function addToCartAction(productId: string, quantity: number): Promise<CartResult> {
  if (!idSchema.safeParse(productId).success || !qtySchema.safeParse(quantity).success) {
    return { ok: false, error: "Invalid request." };
  }
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return { ok: false, error: "Please log in to save items to your cart.", needsLogin: true };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (me?.role === "admin") return { ok: false, error: "Admin accounts don't shop. Use a customer account to place orders." };

  // Everything below is read from the database - the client only says WHICH product and HOW MANY.
  const { data: product } = await supabase
    .from("products")
    .select("id, name, stock, status, store:stores(is_open, status)")
    .eq("id", productId).maybeSingle();
  const store = Array.isArray(product?.store) ? product?.store[0] : product?.store;
  if (!product || product.status !== "active" || !store || store.status !== "approved") {
    return { ok: false, error: "Sorry, this product is no longer available." };
  }
  if (!store.is_open) return { ok: false, error: "This store is currently closed." };
  if (product.stock <= 0) return { ok: false, error: "This product is out of stock." };

  const cartId = await ensureCart(supabase, userId);
  const { data: existing } = await supabase
    .from("cart_items").select("id, quantity").eq("cart_id", cartId).eq("product_id", productId).maybeSingle();

  const have = existing?.quantity ?? 0;
  const target = clampQuantity(have + quantity, product.stock);
  if (have >= target) {
    return { ok: false, error: `You already have all ${product.stock} available in your cart.` };
  }

  const { error } = existing
    ? await supabase.from("cart_items").update({ quantity: target }).eq("id", existing.id)
    : await supabase.from("cart_items").insert({ cart_id: cartId, product_id: productId, quantity: target });
  if (error) return { ok: false, error: "Could not update your cart. Please try again." };

  refresh();
  const capped = have + quantity > target;
  return {
    ok: true, count: await cartCount(supabase),
    message: capped ? `Added - only ${product.stock} available, so your cart is capped at ${target}.` : `Added ${product.name} to your cart.`,
  };
}

export async function updateCartItemAction(itemId: string, quantity: number): Promise<CartResult> {
  if (!idSchema.safeParse(itemId).success || !Number.isInteger(quantity)) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  if (!(await currentUserId(supabase))) return { ok: false, error: "Please log in.", needsLogin: true };

  if (quantity < 1) return removeCartItemAction(itemId);

  // RLS limits this to the caller's own cart items.
  const { data: item } = await supabase
    .from("cart_items").select("id, product:products(stock)").eq("id", itemId).maybeSingle();
  const product = Array.isArray(item?.product) ? item?.product[0] : item?.product;
  if (!item || !product) return { ok: false, error: "This item is no longer available. Please remove it." };

  const target = clampQuantity(quantity, product.stock);
  if (target === 0) return { ok: false, error: "This item is out of stock." };
  const { error } = await supabase.from("cart_items").update({ quantity: target }).eq("id", itemId);
  if (error) return { ok: false, error: "Could not update the quantity. Please try again." };

  refresh();
  return {
    ok: true, count: await cartCount(supabase),
    message: target < quantity ? `Only ${target} available.` : "Cart updated.",
  };
}

export async function removeCartItemAction(itemId: string): Promise<CartResult> {
  if (!idSchema.safeParse(itemId).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  if (!(await currentUserId(supabase))) return { ok: false, error: "Please log in.", needsLogin: true };
  const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
  if (error) return { ok: false, error: "Could not remove the item. Please try again." };
  refresh();
  return { ok: true, count: await cartCount(supabase), message: "Item removed." };
}

/** Removes every item from the signed-in customer's own cart (RLS limits the delete to their cart). */
export async function clearCartAction(): Promise<CartResult> {
  const supabase = await createClient();
  const uid = await currentUserId(supabase);
  if (!uid) return { ok: false, error: "Please log in.", needsLogin: true };
  const { data: cart } = await supabase.from("carts").select("id").eq("user_id", uid).maybeSingle();
  if (cart) {
    const { error } = await supabase.from("cart_items").delete().eq("cart_id", cart.id);
    if (error) return { ok: false, error: "Could not empty the cart. Please try again." };
  }
  refresh();
  return { ok: true, count: 0, message: "Cart emptied." };
}

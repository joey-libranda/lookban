"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/env";
import {
  addressSchema, categorySchema, heroSlideSchema, finalSlug, productSchema, settingsSchema, statusSchema, storeSchema, uuid,
} from "@/lib/validators/admin";
import { slugify } from "@/lib/utils/slug";

/**
 * Every admin mutation: (1) re-checks the caller is an admin on the server, (2) re-validates input with Zod,
 * (3) runs through the caller's own RLS session - so even a bug here cannot exceed what `is_admin()` policies allow.
 * No service-role key is used anywhere.
 */
export type FormState = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> } | null;

const fail = (error: string): FormState => ({ ok: false, error });
const done = (message: string): FormState => ({ ok: true, message });

function flatten(err: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const i of err.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
  return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
}

/** FormData -> plain object; checkboxes become booleans, blank strings stay "" for Zod to judge. */
function toObject(fd: FormData, booleans: string[] = []) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  for (const b of booleans) o[b] = fd.get(b) === "on";
  return o;
}

/** Friendly messages for common Postgres errors. */
function dbError(e: { code?: string; message: string }, what: string): FormState {
  if (e.code === "23505") return fail(`${what} conflicts with an existing one (duplicate name or web address). Change the name or slug.`);
  if (e.code === "23514" && /compare_price/.test(e.message)) return fail("The original price must be higher than the price.");
  if (e.code === "23503") return fail(`${what} is still referenced by other records.`);
  if (e.code === "42501") return fail("You do not have permission to do that.");
  return fail(`Could not save ${what.toLowerCase()}: ${e.message}`);
}

const nullish = (v: unknown) => (v === "" || v === undefined ? null : v);

// ---------------------------------------------------------------- products
export async function saveProductAction(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin("/admin/products");
  const parsed = productSchema.safeParse(toObject(fd));
  if (!parsed.success) return flatten(parsed.error);
  const v = parsed.data;
  const row = {
    store_id: v.store_id, category_id: nullish(v.category_id), name: v.name, variant_label: v.variant_label ?? "",
    slug: finalSlug(v.slug, v.name, v.variant_label), description: nullish(v.description), price: v.price,
    compare_at_price: v.compare_at_price === "" || v.compare_at_price === undefined ? null : Number(v.compare_at_price), stock: v.stock,
    weight: nullish(v.weight), packaging: nullish(v.packaging), quantity_per_pack: nullish(v.quantity_per_pack),
    ingredients: nullish(v.ingredients), storage_instructions: nullish(v.storage_instructions),
    status: v.status,
  };
  const supabase = await createClient();
  if (id) {
    if (!uuid.safeParse(id).success) return fail("Invalid product.");
    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) return dbError(error, "Product");
    revalidatePath("/admin/products"); revalidatePath("/shop"); revalidatePath(`/products/${row.slug}`);
    return done("Product saved.");
  }
  const { data, error } = await supabase.from("products").insert(row).select("id").single();
  if (error) return dbError(error, "Product");
  revalidatePath("/admin/products"); revalidatePath("/shop");
  redirect(`/admin/products/${data.id}?created=1`);
}

export async function setProductStatusAction(id: string, status: "active" | "archived") {
  await requireAdmin("/admin/products");
  if (!uuid.safeParse(id).success || !["active", "archived"].includes(status)) return;
  const supabase = await createClient();
  await supabase.from("products").update({ status }).eq("id", id);
  revalidatePath("/admin/products"); revalidatePath("/shop");
}

/**
 * Deleting a product that has been ordered is blocked by design (order_items keep history);
 * the admin is told to archive instead.
 */
export async function deleteProductAction(id: string): Promise<FormState> {
  await requireAdmin("/admin/products");
  if (!uuid.safeParse(id).success) return fail("Invalid product.");
  const supabase = await createClient();
  const { data: images } = await supabase.from("product_images").select("storage_path").eq("product_id", id);
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") return fail("This product appears in past orders, so it can't be deleted. Archive it instead - it will be hidden from the shop.");
    return dbError(error, "Product");
  }
  const paths = (images ?? []).map((i) => i.storage_path).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from("product-images").remove(paths);
  revalidatePath("/admin/products"); revalidatePath("/shop");
  return done("Product deleted.");
}

// ---------------------------------------------------------------- images
const BUCKET_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/`;

/**
 * Called AFTER the browser uploaded the file straight to Storage (avoids Vercel's body-size limit).
 * We never trust the client's URL: we require the path to sit under the product's store folder
 * and build the public URL ourselves.
 */
export async function addProductImageAction(productId: string, storagePath: string): Promise<FormState> {
  await requireAdmin("/admin/products");
  if (!uuid.safeParse(productId).success) return fail("Invalid product.");
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("id, name, store_id, slug").eq("id", productId).maybeSingle();
  if (!product) return fail("Product not found.");
  if (!storagePath.startsWith(`${product.store_id}/`) || storagePath.includes("..")) return fail("Invalid upload path.");
  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const first = (count ?? 0) === 0;
  const { error } = await supabase.from("product_images").insert({
    product_id: productId, storage_path: storagePath, url: `${BUCKET_PREFIX}product-images/${storagePath}`,
    alt: product.name, position: count ?? 0, is_primary: first,
  });
  if (error) return dbError(error, "Photo");
  revalidatePath(`/admin/products/${productId}`); revalidatePath("/shop"); revalidatePath(`/products/${product.slug}`);
  return done("Photo added.");
}

export async function setPrimaryImageAction(productId: string, imageId: string) {
  await requireAdmin("/admin/products");
  if (!uuid.safeParse(productId).success || !uuid.safeParse(imageId).success) return;
  const supabase = await createClient();
  // Clear first, then set: the partial unique index (if any) never sees two primaries.
  await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  await supabase.from("product_images").update({ is_primary: true }).eq("id", imageId).eq("product_id", productId);
  revalidatePath(`/admin/products/${productId}`); revalidatePath("/shop");
}

export async function deleteProductImageAction(productId: string, imageId: string) {
  await requireAdmin("/admin/products");
  if (!uuid.safeParse(productId).success || !uuid.safeParse(imageId).success) return;
  const supabase = await createClient();
  const { data: img } = await supabase.from("product_images").select("storage_path, is_primary").eq("id", imageId).eq("product_id", productId).maybeSingle();
  if (!img) return;
  await supabase.from("product_images").delete().eq("id", imageId);
  if (img.storage_path) await supabase.storage.from("product-images").remove([img.storage_path]);
  if (img.is_primary) { // promote the next photo so the product keeps a cover image
    const { data: next } = await supabase.from("product_images").select("id").eq("product_id", productId).order("position").limit(1).maybeSingle();
    if (next) await supabase.from("product_images").update({ is_primary: true }).eq("id", next.id);
  }
  revalidatePath(`/admin/products/${productId}`); revalidatePath("/shop");
}

// ---------------------------------------------------------------- stores
export async function saveStoreAction(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin("/admin/stores");
  const parsed = storeSchema.safeParse(toObject(fd, ["is_open"]));
  if (!parsed.success) return flatten(parsed.error);
  const v = parsed.data;
  const row = {
    name: v.name, slug: finalSlug(v.slug, v.name), description: nullish(v.description), address: nullish(v.address),
    contact_phone: nullish(v.contact_phone), contact_email: nullish(v.contact_email), opening_hours: nullish(v.opening_hours),
    is_open: v.is_open, shipping_fee: v.shipping_fee === "" || v.shipping_fee === undefined ? null : v.shipping_fee,
    status: v.status,
  };
  const supabase = await createClient();
  if (id) {
    if (!uuid.safeParse(id).success) return fail("Invalid store.");
    const { error } = await supabase.from("stores").update(row).eq("id", id);
    if (error) return dbError(error, "Store");
    revalidatePath("/admin/stores"); revalidatePath("/stores"); revalidatePath(`/stores/${row.slug}`);
    return done("Store saved.");
  }
  const { data, error } = await supabase.from("stores").insert(row).select("id").single();
  if (error) return dbError(error, "Store");
  revalidatePath("/admin/stores"); revalidatePath("/stores");
  redirect(`/admin/stores/${data.id}?created=1`);
}

/** Logo / cover: browser uploads to the store-assets bucket, then we record the URL after checking the path. */
export async function setStoreImageAction(storeId: string, kind: "logo" | "cover", storagePath: string | null): Promise<FormState> {
  await requireAdmin("/admin/stores");
  if (!uuid.safeParse(storeId).success || !["logo", "cover"].includes(kind)) return fail("Invalid request.");
  if (storagePath && (!storagePath.startsWith(`${storeId}/`) || storagePath.includes(".."))) return fail("Invalid upload path.");
  const supabase = await createClient();
  const url = storagePath ? `${BUCKET_PREFIX}store-assets/${storagePath}` : null;
  const { error } = await supabase.from("stores").update(kind === "logo" ? { logo_url: url } : { cover_url: url }).eq("id", storeId);
  if (error) return dbError(error, "Image");
  revalidatePath(`/admin/stores/${storeId}`); revalidatePath("/stores");
  return done(storagePath ? "Image updated." : "Image removed.");
}

export async function deleteStoreAction(id: string): Promise<FormState> {
  await requireAdmin("/admin/stores");
  if (!uuid.safeParse(id).success) return fail("Invalid store.");
  const supabase = await createClient();
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", id);
  if ((count ?? 0) > 0) return fail(`This store still has ${count} product(s). Delete or move them first, or set the store to Suspended instead.`);
  const { error } = await supabase.from("stores").delete().eq("id", id);
  if (error) return dbError(error, "Store");
  revalidatePath("/admin/stores"); revalidatePath("/stores");
  redirect("/admin/stores?deleted=1");
}

// ---------------------------------------------------------------- categories
export async function saveCategoryAction(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin("/admin/categories");
  const parsed = categorySchema.safeParse(toObject(fd));
  if (!parsed.success) return flatten(parsed.error);
  const v = parsed.data;
  const row = { name: v.name, slug: v.slug || slugify(v.name), description: nullish(v.description), sort_order: v.sort_order };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("categories").update(row).eq("id", id) : await supabase.from("categories").insert(row);
  if (error) return dbError(error, "Category");
  revalidatePath("/admin/categories"); revalidatePath("/categories"); revalidatePath("/shop"); revalidatePath("/");
  return done(id ? "Category saved." : "Category added.");
}

export async function deleteCategoryAction(id: string): Promise<FormState> {
  await requireAdmin("/admin/categories");
  if (!uuid.safeParse(id).success) return fail("Invalid category.");
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id); // products.category_id -> set null
  if (error) return dbError(error, "Category");
  revalidatePath("/admin/categories"); revalidatePath("/categories"); revalidatePath("/shop");
  return done("Category deleted. Its products are now uncategorised.");
}

// ---------------------------------------------------------------- settings / customers / orders
export async function saveSettingsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin("/admin/settings");
  const parsed = settingsSchema.safeParse(toObject(fd));
  if (!parsed.success) return flatten(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert({ key: "default_shipping_fee", value: parsed.data.default_shipping_fee, updated_at: new Date().toISOString() });
  if (error) return dbError(error, "Settings");
  revalidatePath("/admin/settings"); revalidatePath("/cart"); revalidatePath("/checkout");
  return done("Default shipping fee updated. It applies to new orders only.");
}

export async function setCustomerActiveAction(id: string, active: boolean) {
  const { user } = await requireAdmin("/admin/customers");
  if (!uuid.safeParse(id).success || id === user.id) return; // an admin cannot lock themselves out
  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: active }).eq("id", id).eq("role", "customer");
  revalidatePath("/admin/customers");
}

/** Goes through the database function, which enforces the allowed transitions, restocking on cancel, and payment rules. */
export async function updateStoreOrderStatusAction(orderId: string, storeOrderId: string, status: string): Promise<FormState> {
  await requireAdmin("/admin/orders");
  const s = statusSchema.safeParse(status);
  if (!uuid.safeParse(storeOrderId).success || !s.success) return fail("Invalid request.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_store_order_status", { p_store_order_id: storeOrderId, p_status: s.data });
  if (error) return fail(error.message.replace(/^[A-Z_]+:\s*/, "") || "Could not update the status.");
  revalidatePath(`/admin/orders/${orderId}`); revalidatePath("/admin/orders"); revalidatePath("/admin");
  return done("Status updated.");
}

// ---------------------------------------------------------------- customer: profile + single address
export async function saveProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser("/account");
  const name = z.string().trim().min(1, "Name is required").max(80);
  const phone = z.union([z.string().trim().regex(/^(09|\+639)\d{9}$/, "Use a Philippine mobile number like 09171234567"), z.literal("")]);
  const p = z.object({ full_name: name, phone }).safeParse(toObject(fd));
  if (!p.success) return flatten(p.error);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: p.data.full_name, phone: p.data.phone || null }).eq("id", user.id);
  if (error) return dbError(error, "Profile");
  revalidatePath("/account", "layout");
  return done("Profile updated.");
}

/** One saved delivery address per customer: update the default row, or create it. */
export async function saveAddressAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser("/account");
  const p = addressSchema.safeParse(toObject(fd));
  if (!p.success) return flatten(p.error);
  const v = p.data;
  const row = {
    recipient_name: v.full_name, phone: v.phone, line1: v.line1, barangay: nullish(v.barangay),
    city: v.city, province: v.province, postal_code: nullish(v.postal), is_default: true,
  };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("addresses").select("id").eq("user_id", user.id).eq("is_default", true).maybeSingle();
  const { error } = existing
    ? await supabase.from("addresses").update(row).eq("id", existing.id)
    : await supabase.from("addresses").insert({ ...row, user_id: user.id });
  if (error) return dbError(error, "Address");
  revalidatePath("/account"); revalidatePath("/checkout");
  return done("Delivery address saved. It will be filled in for you at checkout.");
}

export async function setMessageReadAction(id: string, read: boolean) {
  await requireAdmin("/admin/messages");
  if (!uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from("contact_messages").update({ status: read ? "read" : "new" }).eq("id", id);
  revalidatePath("/admin/messages");
}

export async function deleteMessageAction(id: string) {
  await requireAdmin("/admin/messages");
  if (!uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from("contact_messages").delete().eq("id", id);
  revalidatePath("/admin/messages");
}

// ---------------------------------------------------------------- home page hero photos
export async function addHeroSlideAction(storagePath: string): Promise<FormState> {
  await requireAdmin("/admin/settings");
  if (!/^slides\/[\w-]+\.(jpg|png|webp)$/.test(storagePath)) return fail("Invalid upload path.");
  const supabase = await createClient();
  const { data: last } = await supabase.from("hero_slides").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("hero_slides").insert({
    image_url: `${BUCKET_PREFIX}hero-banners/${storagePath}`, alt: "LOOKBAN promotion", link_url: "/shop", sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return dbError(error, "Slide");
  revalidatePath("/admin/settings"); revalidatePath("/");
  return done("Photo added.");
}

export async function updateHeroSlideAction(id: string, input: { alt: string; link_url: string; is_active: boolean }): Promise<FormState> {
  await requireAdmin("/admin/settings");
  if (!uuid.safeParse(id).success) return fail("Invalid slide.");
  const parsed = heroSlideSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the fields.");
  const supabase = await createClient();
  const { error } = await supabase.from("hero_slides").update(parsed.data).eq("id", id);
  if (error) return dbError(error, "Slide");
  revalidatePath("/admin/settings"); revalidatePath("/");
  return done("Slide saved.");
}

/** Swap this slide's position with its neighbour. */
export async function moveHeroSlideAction(id: string, direction: "up" | "down"): Promise<FormState> {
  await requireAdmin("/admin/settings");
  if (!uuid.safeParse(id).success) return fail("Invalid slide.");
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("hero_slides").select("id").order("sort_order").order("created_at");
  if (error || !rows) return fail("Could not load slides.");
  const i = rows.findIndex((r) => r.id === id); const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return done("Moved.");
  const order = rows.map((r) => r.id); [order[i], order[j]] = [order[j], order[i]];
  for (let n = 0; n < order.length; n++) {
    const { error: e } = await supabase.from("hero_slides").update({ sort_order: n + 1 }).eq("id", order[n]);
    if (e) return dbError(e, "Slide");
  }
  revalidatePath("/admin/settings"); revalidatePath("/");
  return done("Moved.");
}

export async function deleteHeroSlideAction(id: string): Promise<FormState> {
  await requireAdmin("/admin/settings");
  if (!uuid.safeParse(id).success) return fail("Invalid slide.");
  const supabase = await createClient();
  const { data: row } = await supabase.from("hero_slides").select("image_url").eq("id", id).maybeSingle();
  const { error } = await supabase.from("hero_slides").delete().eq("id", id);
  if (error) return dbError(error, "Slide");
  const marker = "/hero-banners/";
  const at = row?.image_url.indexOf(marker) ?? -1;
  if (row && at >= 0) await supabase.storage.from("hero-banners").remove([row.image_url.slice(at + marker.length)]); // best effort
  revalidatePath("/admin/settings"); revalidatePath("/");
  return done("Slide deleted.");
}

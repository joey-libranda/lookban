"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PHOTO_REQUIRED, RETURN_PHOTO_COUNT, type ReturnReason } from "@/lib/returns";

export type RetResult = { ok: true; message: string; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const clean = (msg: string | undefined, fallback: string) => msg?.replace(/^[A-Z_]+:\s*/, "").trim() || fallback;
const uuid = z.string().uuid();
const PHOTO = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

const createSchema = z.object({
  storeOrderId: uuid,
  reason: z.enum(["damaged", "wrong_item", "missing_item", "not_as_described", "other"], { message: "Choose a reason" }),
  desired: z.enum(["refund", "replacement"], { message: "Choose refund or replacement" }),
  details: z.string().trim().min(5, "Please describe the problem (at least 5 characters)").max(1000, "Keep it under 1000 characters"),
  items: z.array(z.object({ order_item_id: uuid, quantity: z.number().int().min(1) })).min(1, "Choose at least one item"),
  photos: z.array(z.string()).max(RETURN_PHOTO_COUNT),
});
export type CreateReturnInput = z.infer<typeof createSchema>;

function refresh() {
  revalidatePath("/account/returns"); revalidatePath("/vendor/returns"); revalidatePath("/admin/returns");
  revalidatePath("/vendor", "layout"); revalidatePath("/admin", "layout");
}

/** Customer files a request. The database re-checks ownership, delivery, the return window, quantities and photos. */
export async function createReturnAction(input: CreateReturnInput): Promise<RetResult> {
  const { user } = await requireUser("/account/returns");
  const p = createSchema.safeParse(input);
  if (!p.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of p.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const v = p.data;
  if (v.photos.some((x) => !x.startsWith(`${user.id}/`) || !PHOTO.test(x))) return { ok: false, error: "Invalid photo. Please upload it again." };
  if (PHOTO_REQUIRED.includes(v.reason as ReturnReason) && v.photos.length === 0) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { photos: "Add at least one photo of the problem" } };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_return_request", {
    p_store_order_id: v.storeOrderId, p_reason: v.reason, p_details: v.details, p_desired: v.desired, p_items: v.items, p_photos: v.photos,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You already have a request for this part of your order." };
    return { ok: false, error: clean(error.message, "Could not send your request.") };
  }
  refresh(); revalidatePath("/orders", "layout");
  return { ok: true, message: "Request sent. The store will review it.", id: data as string };
}

async function rpc(name: string, args: Record<string, unknown>, done: string): Promise<RetResult> {
  await requireUser("/account/returns");
  const supabase = await createClient();
  const { error } = await supabase.rpc(name, args);
  if (error) return { ok: false, error: clean(error.message, "Something went wrong. Please try again.") };
  refresh();
  return { ok: true, message: done };
}

export async function respondReturnAction(id: string, decision: "approve" | "reject", note: string, resolution: "refund" | "replacement", includeShipping: boolean): Promise<RetResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid request." };
  return rpc("respond_return_request", { p_id: id, p_decision: decision, p_note: note.trim().slice(0, 500) || null, p_resolution: resolution, p_include_shipping: includeShipping },
    decision === "approve" ? "Request approved." : "Request declined. The customer can see your reason.");
}
export async function escalateReturnAction(id: string, note: string): Promise<RetResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid request." };
  return rpc("escalate_return_request", { p_id: id, p_note: note.trim().slice(0, 500) || null }, "Sent to LOOKBAN. We will review it and make the final decision.");
}
export async function cancelReturnAction(id: string): Promise<RetResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid request." };
  return rpc("cancel_return_request", { p_id: id }, "Request withdrawn.");
}
export async function completeReturnAction(id: string, reference: string): Promise<RetResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid request." };
  return rpc("complete_return_request", { p_id: id, p_reference: reference.trim().slice(0, 100) || null }, "Marked as completed. The customer can see it.");
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireVendor } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { documentUpdateSchema, type DocumentUpdateInput } from "@/lib/validators/documents";

export type DocResult = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const clean = (msg: string | undefined, fallback: string) => msg?.replace(/^[A-Z_]+:\s*/, "").trim() || fallback;
const FILE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/;
const id = z.string().uuid();

/**
 * A vendor asks to change the business documents on file. Files were uploaded by the browser into the vendor's
 * private folder. The request stays "pending" until an admin approves it; the database re-checks everything
 * and the record on file only changes on approval.
 */
export async function submitDocumentRequestAction(input: DocumentUpdateInput): Promise<DocResult> {
  const { user, store } = await requireVendor("/vendor/store");
  const p = documentUpdateSchema.safeParse(input);
  if (!p.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of p.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const v = p.data;
  for (const f of [v.permit_path, v.registration_path, v.sanitary_path]) {
    if (f && (!f.startsWith(`${user.id}/`) || !FILE.test(f))) return { ok: false, error: "Invalid file. Please upload your documents again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("store_document_requests").insert({
    store_id: store.id, requested_by: user.id,
    permit_number: v.permit_number ?? null, permit_expiry: v.permit_expiry ?? null, registration_number: v.registration_number ?? null,
    permit_path: v.permit_path ?? null, registration_path: v.registration_path ?? null, sanitary_path: v.sanitary_path ?? null,
    vendor_note: v.vendor_note ?? null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You already have an update waiting for review. Withdraw it first to send a new one." };
    return { ok: false, error: clean(error.message, "Could not send your update.") };
  }
  revalidatePath("/vendor/store"); revalidatePath("/admin/applications");
  return { ok: true, message: "Update sent. LOOKBAN will review it. Your current documents stay on file until then." };
}

export async function withdrawDocumentRequestAction(requestId: string): Promise<DocResult> {
  await requireVendor("/vendor/store");
  if (!id.safeParse(requestId).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { data: row } = await supabase.from("store_document_requests").select("permit_path, registration_path, sanitary_path").eq("id", requestId).eq("status", "pending").maybeSingle();
  const { error } = await supabase.from("store_document_requests").delete().eq("id", requestId).eq("status", "pending");
  if (error) return { ok: false, error: "Could not withdraw the update." };
  const files = [row?.permit_path, row?.registration_path, row?.sanitary_path].filter(Boolean) as string[];
  if (files.length) await supabase.storage.from("vendor-documents").remove(files); // tidy up (blocked for files still on record)
  revalidatePath("/vendor/store"); revalidatePath("/admin/applications");
  return { ok: true, message: "Update withdrawn." };
}

export async function approveDocumentRequestAction(requestId: string, note: string): Promise<DocResult> {
  await requireAdmin("/admin/applications");
  if (!id.safeParse(requestId).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_document_request", { p_id: requestId, p_note: note.trim().slice(0, 500) || null });
  if (error) return { ok: false, error: clean(error.message, "Could not approve this update.") };
  revalidatePath("/admin", "layout"); revalidatePath("/vendor", "layout");
  return { ok: true, message: "Update approved. The new documents are now on file." };
}

export async function rejectDocumentRequestAction(requestId: string, note: string): Promise<DocResult> {
  await requireAdmin("/admin/applications");
  if (!id.safeParse(requestId).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_document_request", { p_id: requestId, p_note: note.trim().slice(0, 500) });
  if (error) return { ok: false, error: clean(error.message, "Could not reject this update.") };
  revalidatePath("/admin", "layout"); revalidatePath("/vendor", "layout");
  return { ok: true, message: "Update rejected. The vendor can see your reason and send a new one." };
}

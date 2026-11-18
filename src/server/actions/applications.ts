"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { applicationSchema, type ApplicationInput } from "@/lib/validators/application";

export type AppResult = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const clean = (msg: string | undefined, fallback: string) => msg?.replace(/^[A-Z_]+:\s*/, "").trim() || fallback;
const FILE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/;

/**
 * A signed-in customer applies to open a store. The proof files were already uploaded (by the browser) into the
 * applicant's own private folder; here we re-check everything. The database trigger re-checks it once more and
 * forces the application to start as "pending" - an applicant can never approve themselves.
 */
export async function submitApplicationAction(input: ApplicationInput): Promise<AppResult> {
  const { user, profile } = await requireUser("/apply");
  if (profile.role !== "customer") return { ok: false, error: "Only customer accounts can apply to open a store." };

  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;
  for (const p of [v.permit_path, v.registration_path, v.sanitary_path]) {
    if (p && (!p.startsWith(`${user.id}/`) || !FILE.test(p))) return { ok: false, error: "Invalid file. Please upload your documents again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vendor_applications").insert({
    applicant_id: user.id,
    store_name: v.store_name, description: v.description, address: v.address, phone: v.phone,
    owner_name: v.owner_name, contact_email: v.contact_email,
    permit_number: v.permit_number, permit_expiry: v.permit_expiry, registration_number: v.registration_number,
    permit_path: v.permit_path, registration_path: v.registration_path, sanitary_path: v.sanitary_path || null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You already have an application waiting for review." };
    return { ok: false, error: clean(error.message, "Could not submit your application.") };
  }
  revalidatePath("/apply");
  revalidatePath("/admin/applications");
  return { ok: true, message: "Application submitted. We'll review your documents and get back to you." };
}

const id = z.string().uuid();

/** Admin: approve. The database creates the store, makes the applicant a vendor and re-checks the proof. */
export async function approveApplicationAction(applicationId: string, note: string): Promise<AppResult> {
  await requireAdmin("/admin/applications");
  if (!id.safeParse(applicationId).success) return { ok: false, error: "Invalid application." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_vendor_application", { p_app_id: applicationId, p_note: note.trim().slice(0, 500) || null });
  if (error) return { ok: false, error: clean(error.message, "Could not approve this application.") };
  revalidatePath("/admin/applications"); revalidatePath("/admin/stores"); revalidatePath("/stores"); revalidatePath("/apply");
  return { ok: true, message: "Application approved. The store has been created." };
}

/** Admin: reject with a reason the applicant will see. They may apply again. */
export async function rejectApplicationAction(applicationId: string, note: string): Promise<AppResult> {
  await requireAdmin("/admin/applications");
  if (!id.safeParse(applicationId).success) return { ok: false, error: "Invalid application." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_vendor_application", { p_app_id: applicationId, p_note: note.trim().slice(0, 500) });
  if (error) return { ok: false, error: clean(error.message, "Could not reject this application.") };
  revalidatePath("/admin/applications"); revalidatePath("/apply");
  return { ok: true, message: "Application rejected. The applicant can see your reason and apply again." };
}

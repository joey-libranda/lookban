"use server";

import { createClient } from "@/lib/supabase/server";
import { contactSchema, type ContactValues } from "@/lib/validators/contact";

export type ContactResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Public endpoint: re-validates everything; RLS only allows inserting new, unread messages. */
export async function sendContactMessageAction(values: ContactValues): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  if (parsed.data.website) return { ok: true }; // honeypot filled: pretend success, store nothing
  const { name, email, subject, message } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert({ name, email, subject, message });
  if (error) return { ok: false, error: "We couldn't send your message right now. Please try again in a moment." };
  return { ok: true };
}

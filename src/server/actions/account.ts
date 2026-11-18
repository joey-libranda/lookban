"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/lib/validators/auth";
import type { FormState } from "@/server/actions/admin";

/**
 * My Account actions, shared by customers, vendors and admins.
 * Each one re-checks the session on the server; the database (RLS + guard trigger + storage policies)
 * enforces the same limits, so a tampered request cannot touch anyone else's data.
 */
const fail = (error: string): FormState => ({ ok: false, error });
const done = (message: string): FormState => ({ ok: true, message });
const clean = (msg: string | undefined, fallback: string) => msg?.replace(/^[A-Z_]+:\s*/, "").trim() || fallback;

const AVATAR_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Records an avatar the browser already uploaded to <uid>/<uuid>.<ext>, and removes the previous file. */
export async function setAvatarAction(path: string): Promise<FormState> {
  const { user, profile } = await requireUser("/account");
  if (typeof path !== "string" || !AVATAR_PATH.test(path) || !path.startsWith(`${user.id}/`)) {
    return fail("That photo could not be used. Please try another one.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) {
    await supabase.storage.from("avatars").remove([path]);
    return fail("Could not save your photo. Please try again.");
  }
  if (profile.avatar_path && profile.avatar_path !== path) await supabase.storage.from("avatars").remove([profile.avatar_path]);
  revalidatePath("/", "layout");
  return done("Profile photo updated.");
}

export async function removeAvatarAction(): Promise<FormState> {
  const { user, profile } = await requireUser("/account");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", user.id);
  if (error) return fail("Could not remove your photo. Please try again.");
  if (profile.avatar_path) await supabase.storage.from("avatars").remove([profile.avatar_path]);
  revalidatePath("/", "layout");
  return done("Profile photo removed.");
}

/** Verifies the current password first, so a borrowed, unlocked laptop cannot change it. */
export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser("/account");
  const p = changePasswordSchema.safeParse({
    current_password: fd.get("current_password") ?? "",
    password: fd.get("password") ?? "",
    confirm_password: fd.get("confirm_password") ?? "",
  });
  if (!p.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of p.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const supabase = await createClient();
  if (!user.email) return fail("Your account has no email on file.");
  const { error: badPw } = await supabase.auth.signInWithPassword({ email: user.email, password: p.data.current_password });
  if (badPw) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { current_password: "That is not your current password" } };
  const { error } = await supabase.auth.updateUser({ password: p.data.password });
  if (error) return fail(clean(error.message, "Could not change your password."));
  return done("Password changed.");
}

/** Ends every session on every device (including this one). The client then goes to /login. */
export async function signOutEverywhereAction(): Promise<FormState> {
  await requireUser("/account");
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) return fail("Could not log you out of other devices. Please try again.");
  return done("Logged out of all devices.");
}

/**
 * Customers only. Confirms the password, then the database function blocks the delete while orders are
 * still in progress and keeps finished orders (without the customer attached) so receipts stay accurate.
 */
export async function deleteMyAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user, profile } = await requireUser("/account");
  if (profile.role !== "customer") return fail("Only customer accounts can be deleted here.");
  const password = String(fd.get("password") ?? "");
  if (!password) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { password: "Enter your password to confirm" } };
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { confirm: "Type DELETE to confirm" } };
  }
  const supabase = await createClient();
  if (!user.email) return fail("Your account has no email on file.");
  const { error: badPw } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (badPw) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { password: "That is not your password" } };
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return fail(clean(error.message, "Could not delete your account."));
  await supabase.auth.signOut().catch(() => undefined);
  return done("Your account has been deleted.");
}

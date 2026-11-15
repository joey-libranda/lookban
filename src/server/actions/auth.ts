"use server";

import { redirect } from "next/navigation";
import { SITE_URL } from "@/lib/env";
import { safeNext } from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import {
  forgotSchema, loginSchema, registerSchema, resetSchema,
  type ForgotValues, type LoginValues, type RegisterValues, type ResetValues,
} from "@/lib/validators/auth";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

// Server Actions are public HTTP endpoints: every input is re-validated here,
// never trusting the client-side form validation.

export async function loginAction(values: LoginValues, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: signedIn, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/confirm/i.test(error.message)) {
      return { ok: false, error: "Please confirm your email first. Check your inbox for the link." };
    }
    // One generic message: don't reveal whether the email exists.
    return { ok: false, error: "Incorrect email or password." };
  }
  const target = safeNext(next);
  // Admins go straight to their dashboard unless they were sent to a specific admin page.
  if (target === "/account" || target === "/") {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", signedIn.user.id).maybeSingle();
    if (me?.role === "admin") redirect("/admin");
  }
  redirect(target);
}

export async function registerAction(values: RegisterValues): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email, password, full_name, phone } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Stored in raw_user_meta_data; the handle_new_user() trigger copies it into
      // profiles. The role is NEVER taken from here - new accounts are always customers.
      data: { full_name, phone: phone || "" },
      emailRedirectTo: `${SITE_URL}/auth/callback?next=/account`,
    },
  });
  if (error) return { ok: false, error: error.message };

  if (data.session) redirect("/account"); // email confirmation disabled in Supabase
  return {
    ok: true,
    message: "Account created! Check your email and click the confirmation link to finish signing up.",
  };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function forgotPasswordAction(values: ForgotValues): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the email exists.
  return { ok: true, message: "If that email has an account, a reset link is on its way." };
}

export async function resetPasswordAction(values: ResetValues): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "This reset link has expired. Please request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.message };
  redirect("/account");
}

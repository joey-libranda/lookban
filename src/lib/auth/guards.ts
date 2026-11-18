import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Store, UserRole } from "@/types/db";

/**
 * The verified current user + profile, or null. Uses auth.getUser(), which
 * re-validates the token with Supabase Auth (never trust an unverified cookie).
 * Cached per request.
 */
export const getCurrentUser = cache(async () => {
  if (!isSupabaseConfigured()) return null; // unconfigured dev environment: behave as signed out
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, is_active, avatar_path, created_at")
    .eq("id", auth.user.id)
    .single<Profile>();

  if (!profile || !profile.is_active) return null;
  return { user: auth.user, profile };
});

/** Any signed-in, active user. Redirects to /login (remembering where they were going). */
export async function requireUser(next = "/account") {
  const current = await getCurrentUser();
  if (!current) redirect(`/login?next=${encodeURIComponent(next)}`);
  return current;
}

/** Signed-in user with one of the given roles; otherwise 403 page. */
export async function requireRole(roles: UserRole[], next: string) {
  const current = await requireUser(next);
  if (!roles.includes(current.profile.role)) redirect("/unauthorized");
  return current;
}

export const requireAdmin = (next = "/admin") => requireRole(["admin"], next);

/** Vendor who owns an approved store. Returns the store the vendor may manage. */
export async function requireVendor(next = "/vendor") {
  const current = await requireRole(["vendor"], next);
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("id, owner_id, slug, name, description, address, logo_url, cover_url, status")
    .eq("owner_id", current.user.id)
    .maybeSingle<Store>();
  if (!store) redirect("/unauthorized");
  return { ...current, store };
}

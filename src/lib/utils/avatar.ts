import { SUPABASE_URL } from "@/lib/env";

/** Public URL of a profile photo stored in the "avatars" bucket (path is <uid>/<file>). */
export const avatarUrl = (path: string | null | undefined) =>
  path && SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}` : null;

export const initials = (name: string | null | undefined, email?: string | null) => {
  const src = (name ?? "").trim() || (email ?? "").split("@")[0] || "?";
  const parts = src.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

import "server-only"; // build fails if this file is ever imported from client code
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Service-role client. BYPASSES Row Level Security.
 * Use only inside server code after you have verified the caller's role
 * (see lib/auth/guards.ts), and only when RLS-scoped access is not enough.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set (server-only variable).");
  return createClient(SUPABASE_URL, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

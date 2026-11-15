import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic"; // built from live data, so it must not be frozen at build time

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = ["", "/shop", "/stores", "/about", "/contact"].map((p) => ({ url: `${SITE_URL}${p}` }));
  if (!isSupabaseConfigured()) return base;
  try {
    const supabase = await createClient();
    const stores = await supabase.from("stores").select("slug").eq("status", "approved");
    return [
      ...base,
      ...(stores.data ?? []).map((s) => ({ url: `${SITE_URL}/stores/${s.slug}` })),
    ];
  } catch {
    return base; // never let a database hiccup break the sitemap
  }
}

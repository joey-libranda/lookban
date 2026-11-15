import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

// Private areas are not for search engines. (This is a courtesy; real protection is the login + RLS.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/cart", "/checkout", "/orders", "/auth", "/login", "/register"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

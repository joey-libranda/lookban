import { createClient } from "@/lib/supabase/server";
import { SOCIALS } from "@/lib/site";

type SocialKey = (typeof SOCIALS)[number]["key"];
export interface SocialLink { key: SocialKey; label: string; href: string; visible: boolean }

/** The About page banner photo the admin chose in Settings, or null (the built-in photo is used). */
export async function getAboutHero(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("settings").select("value").eq("key", "about_hero_image").maybeSingle();
    return typeof data?.value === "string" ? data.value : null;
  } catch { return null; }
}

/** All three social buttons: the admin's saved link and visibility, falling back to the defaults. */
export async function getSocialLinks(): Promise<SocialLink[]> {
  let saved: { key?: string; href?: string; visible?: boolean }[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("settings").select("value").eq("key", "social_links").maybeSingle();
    if (Array.isArray(data?.value)) saved = data.value;
  } catch { /* use defaults */ }
  return SOCIALS.map((d) => {
    const s = saved.find((x) => x.key === d.key);
    return { key: d.key, label: d.label, href: s?.href || d.href, visible: s?.visible ?? true };
  });
}

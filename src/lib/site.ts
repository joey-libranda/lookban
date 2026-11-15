/**
 * Public contact details and social links, shown in the footer and on the Contact page.
 * Set the NEXT_PUBLIC_* values in .env.local / Vercel; nothing here is a real business detail until you do.
 * Unset phone/email are simply not shown; unset social links open the platform's home page.
 */
export const CONTACT = {
  address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS || "Lucban, Quezon, Philippines",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  hours: process.env.NEXT_PUBLIC_CONTACT_HOURS || "",
};

export const SOCIALS = [
  { key: "facebook", label: "Facebook", href: process.env.NEXT_PUBLIC_FACEBOOK_URL || "https://www.facebook.com/" },
  { key: "instagram", label: "Instagram", href: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/" },
  { key: "tiktok", label: "TikTok", href: process.env.NEXT_PUBLIC_TIKTOK_URL || "https://www.tiktok.com/" },
] as const;

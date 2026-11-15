/**
 * Built-in fallback photos for the home page hero card, used only until an admin adds photos in Admin > Settings > Hero photos.
 * `zoom` and `position` crop into a part of the photo (the same photo can be used for several slides).
 */
export type HeroPhoto = { src: string; alt: string; href: string; zoom?: number; position?: string };

export const HERO_PHOTOS: HeroPhoto[] = [
  { src: "/images/pahiyas-festival.jpg", alt: "Pahiyas Festival in Lucban, Quezon: a house decorated with colorful kiping", href: "/about" },
  { src: "/images/pahiyas-festival.jpg", alt: "Close-up of the PAHIYAS lettering made of colorful kiping", href: "/shop", zoom: 1.7, position: "28% 55%" },
  { src: "/images/pahiyas-festival.jpg", alt: "Close-up of bananas and produce decorating a Pahiyas house", href: "/stores", zoom: 1.8, position: "70% 85%" },
];

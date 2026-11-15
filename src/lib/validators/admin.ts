import { z } from "zod";
import { slugify } from "@/lib/utils/slug";
import { phoneSchema } from "@/lib/validators/auth";

const req = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
const opt = (max: number) => z.string().trim().max(max, "Too long").optional().or(z.literal(""));
const money = z.coerce.number({ message: "Enter a number" }).min(0, "Cannot be negative").max(1_000_000, "Too large");
const slugField = z.string().trim().max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes").optional().or(z.literal(""));
export const uuid = z.string().uuid();

const productBase = z.object({
  store_id: uuid,
  category_id: uuid.optional().or(z.literal("")),
  name: req("Name", 120),
  variant_label: opt(60),
  slug: slugField,
  description: opt(2000),
  price: money,
  compare_at_price: z.union([money, z.literal("")]).optional(),
  stock: z.coerce.number({ message: "Enter a whole number" }).int("Whole numbers only").min(0).max(100000),
  weight: opt(40), packaging: opt(80), quantity_per_pack: opt(80),
  ingredients: opt(600), storage_instructions: opt(600),
  status: z.enum(["active", "archived"]),
});
export const productSchema = productBase.superRefine((v, ctx) => {
  const c = v.compare_at_price;
  if (c !== undefined && c !== "" && !(Number(c) > v.price)) {
    ctx.addIssue({ code: "custom", path: ["compare_at_price"], message: "Must be higher than the price (it is the original price before the discount)" });
  }
});
export type ProductInput = z.infer<typeof productSchema>;

export const storeSchema = z.object({
  name: req("Store name", 100),
  slug: slugField,
  description: opt(1500), address: opt(250),
  contact_phone: opt(40),
  contact_email: z.union([z.string().trim().email("Invalid email"), z.literal("")]).optional(),
  opening_hours: opt(120),
  is_open: z.boolean(),
  shipping_fee: z.union([money, z.literal("")]).optional(),
  status: z.enum(["pending", "approved", "suspended"]),
});

export const categorySchema = z.object({
  name: req("Name", 60), slug: slugField, description: opt(300),
  sort_order: z.coerce.number().int().min(0).max(999),
});

export const settingsSchema = z.object({ default_shipping_fee: money });

export const statusSchema = z.enum(["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]);

export const addressSchema = z.object({
  full_name: req("Full name", 80),
  phone: phoneSchema,
  line1: req("House no. / street", 150),
  barangay: opt(80), city: req("City / municipality", 80), province: req("Province", 80),
  postal: z.union([z.string().trim().regex(/^\d{4}$/, "Postal code is 4 digits"), z.literal("")]).optional(),
});

export const finalSlug = (slug: string | undefined, name: string, variant = "") =>
  slug && slug.length ? slug : slugify(`${name} ${variant}`);

/** Hero slide: link must be a page on this site (starts with a single "/"), never an outside address. */
export const heroSlideSchema = z.object({
  alt: z.string().trim().min(1, "Describe the photo.").max(200),
  link_url: z.string().trim().max(200).regex(/^\/($|[^/\\])/, "Use a page on this site, like /shop or /stores."),
  is_active: z.boolean(),
});

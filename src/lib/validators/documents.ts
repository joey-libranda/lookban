import { z } from "zod";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const txt = (label: string) => z.preprocess(blank, z.string().trim().min(3, `${label} must be at least 3 characters`).max(60, `${label} is too long`).optional());

/** What a vendor may ask to change. Anything left empty stays as it is on file. */
export const documentUpdateSchema = z.object({
  permit_number: txt("Permit number"),
  permit_expiry: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the permit's expiry date")
    .refine((d) => d >= new Date().toISOString().slice(0, 10), "The new expiry date must be in the future").optional()),
  registration_number: txt("Registration number"),
  permit_path: z.string().optional(),
  registration_path: z.string().optional(),
  sanitary_path: z.string().optional(),
  vendor_note: z.preprocess(blank, z.string().trim().max(500, "Keep the note under 500 characters").optional()),
});
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;

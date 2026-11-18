import { z } from "zod";
import { phoneSchema } from "@/lib/validators/auth";

const text = (label: string, min: number, max: number) =>
  z.string().trim().min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`).max(max, `${label} is too long`);

/** Business information (typed fields). Checked in the browser before uploading AND again on the server. */
export const applicationFieldsSchema = z.object({
  store_name: text("Store name", 2, 80),
  description: text("Store description", 20, 600),
  address: text("Business address", 5, 200),
  owner_name: text("Owner's full name", 2, 80),
  contact_email: z.string().trim().toLowerCase().min(1, "Business email is required").email("Enter a valid email").max(120),
  phone: phoneSchema,
  permit_number: text("Business permit number", 3, 60),
  permit_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the permit's expiry date").refine((d) => d >= new Date().toISOString().slice(0, 10), "The permit must still be valid (not expired)"),
  registration_number: text("DTI / SEC / CDA registration number", 3, 60),
});

/** Full submission: fields + the paths of the uploaded proof files + the truthfulness confirmation. */
export const applicationSchema = applicationFieldsSchema.extend({
  permit_path: z.string().min(1, "Upload your Business / Mayor's Permit"),
  registration_path: z.string().min(1, "Upload your DTI / SEC / CDA registration"),
  sanitary_path: z.string().optional(),
  confirm: z.literal(true, { message: "Please confirm that the information is true" }),
});
export type ApplicationFields = z.infer<typeof applicationFieldsSchema>;
export type ApplicationInput = z.infer<typeof applicationSchema>;

/** Proof files: PDF or photo, up to 5 MB (the storage bucket enforces the same limits). */
export const PROOF_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;

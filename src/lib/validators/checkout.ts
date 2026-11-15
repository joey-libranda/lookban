import { z } from "zod";
import { phoneSchema } from "@/lib/validators/auth";

const text = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const checkoutSchema = z.object({
  full_name: text("Full name", 80),
  phone: phoneSchema,
  line1: text("House no. / street", 150),
  barangay: z.string().trim().max(80).optional().or(z.literal("")),
  city: text("City / municipality", 80),
  province: text("Province", 80),
  postal: z.union([z.string().trim().regex(/^\d{4}$/, "Postal code is 4 digits"), z.literal("")]).optional(),
  notes: z.string().trim().max(300, "Notes can be at most 300 characters").optional().or(z.literal("")),
  // The ONLY payment options. Payment STATUS is never accepted from the client: the database sets it.
  payment_method: z.enum(["cod", "simulated_online"]),
});
export type CheckoutValues = z.infer<typeof checkoutSchema>;

/** Visitors must leave an email, so the store and LOOKBAN have a second way to reach them. */
export const guestCheckoutSchema = checkoutSchema.extend({
  email: z.string().trim().min(1, "Email is required").max(120, "Email is too long").email("Enter a valid email"),
});
export type GuestCheckoutValues = z.infer<typeof guestCheckoutSchema>;

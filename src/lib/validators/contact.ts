import { z } from "zod";

export const CONTACT_SUBJECTS = ["Order inquiry", "Product question", "Delivery", "Bulk orders", "Become a LOOKBAN store", "Other"] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  subject: z.enum(CONTACT_SUBJECTS, { message: "Choose a subject" }),
  message: z.string().trim().min(10, "Write at least 10 characters").max(2000, "Keep it under 2000 characters"),
  website: z.string().max(0).optional(), // honeypot: real people never fill this in
});
export type ContactValues = z.infer<typeof contactSchema>;

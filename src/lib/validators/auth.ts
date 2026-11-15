import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

// Philippine mobile: 09XXXXXXXXX or +639XXXXXXXXX. Optional at registration.
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(09|\+639)\d{9}$/, "Use a Philippine mobile number like 09171234567");

const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(80),
    email,
    phone: z.union([phoneSchema, z.literal("")]).optional(),
    password,
    confirm_password: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
  });

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({ password, confirm_password: z.string() })
  .refine((v) => v.password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotValues = z.infer<typeof forgotSchema>;
export type ResetValues = z.infer<typeof resetSchema>;

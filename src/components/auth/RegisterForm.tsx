"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FormNotice } from "@/components/ui/Field";
import { registerSchema, type RegisterValues } from "@/lib/validators/auth";
import { registerAction } from "@/server/actions/auth";
import { useAuthSubmit } from "./useAuthForm";

export function RegisterForm() {
  const { register, handleSubmit, formState: { errors } } =
    useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });
  const { pending, result, submit } = useAuthSubmit();

  if (result?.ok) return <FormNotice kind="success">{result.message}</FormNotice>;

  return (
    <form onSubmit={handleSubmit((v) => submit(() => registerAction(v)))} className="space-y-4" noValidate>
      <Field placeholder="e.g. Juan Dela Cruz" label="Full name" autoComplete="name" error={errors.full_name} {...register("full_name")} />
      <Field placeholder="you@email.com" label="Email" type="email" autoComplete="email" error={errors.email} {...register("email")} />
      <Field label="Mobile number (optional)" type="tel" autoComplete="tel" placeholder="09171234567"
             error={errors.phone} {...register("phone")} />
      <Field placeholder="Create a password" label="Password" type="password" autoComplete="new-password"
             hint="At least 8 characters, with a letter and a number." error={errors.password} {...register("password")} />
      <Field placeholder="Type the password again" label="Confirm password" type="password" autoComplete="new-password"
             error={errors.confirm_password} {...register("confirm_password")} />
      {result && !result.ok && <FormNotice kind="error">{result.error}</FormNotice>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Creating Account…" : "Create Account"}
      </button>
    </form>
  );
}

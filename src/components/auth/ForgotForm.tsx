"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FormNotice } from "@/components/ui/Field";
import { forgotSchema, type ForgotValues } from "@/lib/validators/auth";
import { forgotPasswordAction } from "@/server/actions/auth";
import { useAuthSubmit } from "./useAuthForm";

export function ForgotForm() {
  const { register, handleSubmit, formState: { errors } } =
    useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });
  const { pending, result, submit } = useAuthSubmit();

  if (result?.ok) return <FormNotice kind="success">{result.message}</FormNotice>;

  return (
    <form onSubmit={handleSubmit((v) => submit(() => forgotPasswordAction(v)))} className="space-y-4" noValidate>
      <Field label="Email" type="email" autoComplete="email" error={errors.email} {...register("email")} />
      {result && !result.ok && <FormNotice kind="error">{result.error}</FormNotice>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

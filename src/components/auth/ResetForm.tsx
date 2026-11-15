"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FormNotice } from "@/components/ui/Field";
import { resetSchema, type ResetValues } from "@/lib/validators/auth";
import { resetPasswordAction } from "@/server/actions/auth";
import { useAuthSubmit } from "./useAuthForm";

export function ResetForm() {
  const { register, handleSubmit, formState: { errors } } =
    useForm<ResetValues>({ resolver: zodResolver(resetSchema) });
  const { pending, result, submit } = useAuthSubmit();

  return (
    <form onSubmit={handleSubmit((v) => submit(() => resetPasswordAction(v)))} className="space-y-4" noValidate>
      <Field label="New password" type="password" autoComplete="new-password"
             hint="At least 8 characters, with a letter and a number." error={errors.password} {...register("password")} />
      <Field label="Confirm new password" type="password" autoComplete="new-password"
             error={errors.confirm_password} {...register("confirm_password")} />
      {result && !result.ok && <FormNotice kind="error">{result.error}</FormNotice>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Saving…" : "Save New Password"}
      </button>
    </form>
  );
}

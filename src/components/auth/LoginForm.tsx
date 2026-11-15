"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FormNotice } from "@/components/ui/Field";
import { loginSchema, type LoginValues } from "@/lib/validators/auth";
import { loginAction } from "@/server/actions/auth";
import { useAuthSubmit } from "./useAuthForm";

export function LoginForm({ next }: { next?: string }) {
  const { register, handleSubmit, formState: { errors } } =
    useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const { pending, result, submit } = useAuthSubmit();

  return (
    <form onSubmit={handleSubmit((v) => submit(() => loginAction(v, next)))} className="space-y-4" noValidate>
      <Field label="Email" type="email" autoComplete="email" error={errors.email} {...register("email")} />
      <Field label="Password" type="password" autoComplete="current-password" error={errors.password} {...register("password")} />
      {result && !result.ok && <FormNotice kind="error">{result.error}</FormNotice>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="font-medium text-blue pop hover:text-orange">Forgot your password?</Link>
      </p>
    </form>
  );
}

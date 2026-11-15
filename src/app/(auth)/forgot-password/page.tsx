import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/ForgotForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-1 text-3xl">Reset your password</h1>
      <p className="mb-6 text-muted">Enter your email and we&apos;ll send you a reset link.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-blue pop hover:text-orange">Back to log in</Link>
      </p>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1 text-3xl">Join LOOKBAN</h1>
      <p className="mb-6 text-muted">Shop Lucban&apos;s local stores in one cart.</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-blue pop hover:text-orange">Log in</Link>
      </p>
    </>
  );
}

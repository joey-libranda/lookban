import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { FormNotice } from "@/components/ui/Field";
import { safeNext } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = { title: "Log In" };

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="mb-1 text-3xl">Welcome back</h1>
      <p className="mb-6 text-muted">Log in to check out and track your orders.</p>
      {error === "link" && (
        <div className="mb-4"><FormNotice kind="error">That link is invalid or has expired. Please try again.</FormNotice></div>
      )}
      <LoginForm next={safeNext(next, "/account")} />
      <p className="mt-6 text-center text-sm">
        New to LOOKBAN?{" "}
        <Link href="/register" className="font-semibold text-brand pop hover:text-orange">Create an account</Link>
      </p>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/auth/ResetForm";
import { FormNotice } from "@/components/ui/Field";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The email link signs the user in via /auth/callback; without that session there is nothing to reset.
  const current = await getCurrentUser();
  if (!current) {
    return (
      <>
        <FormNotice kind="error">This reset link is invalid or has expired.</FormNotice>
        <p className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="font-semibold text-blue pop hover:text-orange">Request a new link</Link>
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-6 text-3xl">Choose a new password</h1>
      <ResetForm />
    </>
  );
}

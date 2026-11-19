import { ThemeToggle } from "@/components/layout/ThemeToggle";
import Image from "next/image";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { FormNotice } from "@/components/ui/Field";
import { BackButton } from "@/components/auth/BackButton";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-10">
      <div className="absolute right-3 top-3"><ThemeToggle /></div>
      <Link href="/" aria-label="LOOKBAN home" className="mb-4">
        <Image src="/brand/lookban-logo.png" alt="LOOKBAN - local finds, lucban pride" width={220} height={96} priority className="dark:hidden" />
        <Image src="/brand/lookban-logo-dark.png" alt="" aria-hidden width={220} height={96} priority className="hidden dark:block" />
      </Link>
      <div className="card w-full max-w-md p-6 shadow-sm sm:p-8">
        <BackButton />
        {!isSupabaseConfigured() && (
          <div className="mb-4">
            <FormNotice kind="error">
              Supabase is not configured yet. Copy <code>.env.example</code> to <code>.env.local</code> and add your project keys.
            </FormNotice>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

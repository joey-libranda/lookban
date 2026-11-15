import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Access denied" };

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-4xl">You don&apos;t have access to that page</h1>
      <p className="mt-3 text-muted">This area is only for LOOKBAN administrators.</p>
      <Link href="/" className="btn-primary mt-8">Back to Home</Link>
    </div>
  );
}

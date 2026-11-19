import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { ReturnsTable } from "@/components/returns/ReturnParts";
import { listReturns } from "@/server/queries/returns";

export const metadata: Metadata = { title: "My Returns" };

export default async function MyReturnsPage() {
  await requireUser("/account/returns");
  const rows = await listReturns();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="mb-6"><Link href="/account" className="inline-flex items-center gap-1.5 font-semibold text-brand pop hover:text-orange"><ArrowLeft className="size-4" aria-hidden /> My Account</Link></p>
      <h1 className="text-4xl">My Returns</h1>
      <p className="mb-6 mt-1 text-muted">To start one, open a delivered order and choose Request Return or Refund.</p>
      <ReturnsTable rows={rows} base="/account/returns" empty="You haven't sent any return requests." />
    </div>
  );
}

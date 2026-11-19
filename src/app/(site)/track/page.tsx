import type { Metadata } from "next";
import Link from "next/link";
import { TrackForm } from "@/components/order/TrackForm";

export const metadata: Metadata = { title: "Track your order" };

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="text-4xl">Track your order</h1>
      <p className="mb-6 mt-2 text-muted">Ordered without an account? Enter the receipt number on your confirmation and the mobile number you used at checkout.</p>
      <div className="card p-5"><TrackForm /></div>
      <p className="mt-5 text-sm text-muted">Have an account? <Link href="/account/orders" className="font-semibold text-brand pop hover:text-orange">See all your orders</Link>.</p>
    </div>
  );
}

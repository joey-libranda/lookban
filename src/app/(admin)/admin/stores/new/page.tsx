import type { Metadata } from "next";
import Link from "next/link";
import { StoreForm } from "@/components/admin/StoreForm";
import { saveStoreAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Add store · Admin" };

export default function NewStore() {
  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/admin/stores" className="text-sm font-semibold text-brand pop hover:text-orange">← Stores</Link>
      <h1 className="text-4xl">Add Store</h1>
      <p className="text-muted">Save the store first, then you can upload its logo and cover photo.</p>
      <div className="card p-5"><StoreForm action={saveStoreAction.bind(null, null)} submitLabel="Create Store" /></div>
    </div>
  );
}

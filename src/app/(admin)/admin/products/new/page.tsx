import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/admin/ProductForm";
import { getAdminCategoryOptions, getAdminStoreOptions } from "@/server/queries/admin";
import { saveProductAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Add product · Admin" };

export default async function NewProduct() {
  const [stores, categories] = await Promise.all([getAdminStoreOptions(), getAdminCategoryOptions()]);
  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/admin/products" className="text-sm font-semibold text-blue pop hover:text-orange">← Products</Link>
      <h1 className="text-4xl">Add product</h1>
      <p className="text-muted">Save the product first, then you can upload its photos.</p>
      {stores.length === 0 ? <p className="card p-5">Create a store first under Stores.</p> : (
        <div className="card p-5"><ProductForm action={saveProductAction.bind(null, null)} stores={stores} categories={categories} submitLabel="Create Product" /></div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireVendor } from "@/lib/auth/guards";
import { ProductForm } from "@/components/admin/ProductForm";
import { getAdminCategoryOptions } from "@/server/queries/admin";
import { saveProductAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Add product · Vendor" };

export default async function NewVendorProduct() {
  const { store } = await requireVendor("/vendor/products/new");
  const categories = await getAdminCategoryOptions();
  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/vendor/products" className="text-sm font-semibold text-brand pop hover:text-orange">← Products</Link>
      <h1 className="text-4xl">Add Product</h1>
      <p className="text-muted">Save the product first, then you can upload its photos. LOOKBAN reviews every new product before it appears in the shop.</p>
      <div className="card p-5">
        <ProductForm action={saveProductAction.bind(null, null)} stores={[]} categories={categories} vendor={{ storeId: store.id }} submitLabel="Submit for Approval" />
      </div>
    </div>
  );
}

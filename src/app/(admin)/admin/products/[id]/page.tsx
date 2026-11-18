import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { ProductReview } from "@/components/admin/ProductReview";
import { ApprovalBadge } from "@/components/admin/ApprovalBadge";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SafeImage } from "@/components/ui/SafeImage";
import { FlashToast } from "@/components/ui/FlashToast";
import { getAdminCategoryOptions, getAdminProduct, getAdminStoreOptions } from "@/server/queries/admin";
import { addProductImageAction, deleteProductAction, deleteProductImageAction, saveProductAction, setPrimaryImageAction } from "@/server/actions/admin";
import { uuid } from "@/lib/validators/admin";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Edit product · Admin" };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!uuid.safeParse(id).success) notFound();
  const [product, stores, categories] = await Promise.all([getAdminProduct(id), getAdminStoreOptions(), getAdminCategoryOptions()]);
  if (!product) notFound();

  async function remove() {
    "use server";
    const r = await deleteProductAction(id);
    if (r?.ok) redirect("/admin/products");
    return r;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/products" className="text-sm font-semibold text-blue pop hover:text-orange">← Products</Link>
      {(() => {
        const approval = (product.approval_status ?? "approved") as "approved" | "pending" | "rejected";
        const storeName = stores.find((s) => s.id === product.store_id)?.name ?? "The store";
        return (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl">{product.name}</h1>
              {approval !== "approved" && <ApprovalBadge approval={approval} status={product.status as "active" | "archived"} />}
            </div>
            {approval === "pending" && <ProductReview id={id} name={product.name as string} storeName={storeName} />}
            {approval === "rejected" && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">You sent this back to the store{product.review_note ? `: “${product.review_note}”` : "."} It returns to your approval list when the store edits it again.</p>
            )}
          </>
        );
      })()}
      {created && <FlashToast text="Product created. Add its photos below." />}

      <section className="card p-5" aria-labelledby="photos">
        <h2 id="photos" className="text-2xl">Photos</h2>
        <p className="mt-1 text-sm text-muted">The first (cover) photo appears in the shop. Without a photo, customers see a Photo coming soon tile.</p>
        {product.images.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {product.images.map((img) => (
              <li key={img.id} className="space-y-2">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-cream">
                  <SafeImage src={img.url} alt={img.alt ?? product.name} sizes="200px" />
                  {img.is_primary && <span className="absolute left-2 top-2 rounded-full bg-blue px-2 py-0.5 text-xs font-semibold text-white">Cover</span>}
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  {!img.is_primary && (
                    <form action={setPrimaryImageAction.bind(null, id, img.id)}><button className="font-semibold text-blue pop hover:text-orange">Make Cover</button></form>
                  )}
                  <ConfirmButton className="text-sm font-semibold text-red-700 pop hover:text-red-900" confirm="Delete this photo?" action={deleteProductImageAction.bind(null, id, img.id)}>Delete</ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <ImageUploader bucket="product-images" folder={product.store_id as string} label="Upload Photos" multiple
            onUploaded={addProductImageAction.bind(null, id)} />
        </div>
      </section>

      <section className="card p-5" aria-labelledby="details">
        <h2 id="details" className="mb-4 text-2xl">Details</h2>
        <ProductForm action={saveProductAction.bind(null, id)} product={product} stores={stores} categories={categories} submitLabel="Save Changes" />
      </section>

      <section className="card border-red-200 p-5">
        <h2 className="text-xl">Remove Product</h2>
        <p className="mt-1 text-sm text-muted">Archiving hides it from the shop but keeps order history. Products already ordered can only be archived.</p>
        <div className="mt-3"><ConfirmButton action={remove} confirm="Permanently delete this product and its photos?" className="btn border-2 border-red-700 text-red-700 hover:bg-red-50">Delete Product</ConfirmButton></div>
      </section>
    </div>
  );
}

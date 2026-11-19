import type { Metadata } from "next";
import Link from "next/link";
import { BusinessDocuments } from "@/components/vendor/BusinessDocuments";
import { requireVendor } from "@/lib/auth/guards";
import { getAdminStore } from "@/server/queries/admin";
import { VendorStoreForm } from "@/components/admin/VendorStoreForm";
import { StoreImageUploader } from "@/components/admin/StoreImageUploader";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SafeImage } from "@/components/ui/SafeImage";
import { setStoreImageAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Store info · Vendor" };

export default async function VendorStorePage() {
  const { user, store: mine } = await requireVendor("/vendor/store");
  const store = await getAdminStore(mine.id); // RLS: a vendor can only read and change their own store
  if (!store) return null;

  const imageBlock = (kind: "logo" | "cover", url: string | null, label: string, box: string) => (
    <div>
      <p className="label">{label}</p>
      <div className={`relative overflow-hidden rounded-lg bg-cream ${box}`}><SafeImage src={url} alt={`${store.name} ${kind}`} sizes="320px" compact={kind === "logo"} /></div>
      <div className="mt-3">
        <StoreImageUploader storeId={mine.id} kind={kind}>
          {url && <ConfirmButton className="btn border-2 border-red-700 text-red-700 hover:bg-red-50" confirm={`Remove the ${kind}?`} action={setStoreImageAction.bind(null, mine.id, kind, null)}>Remove</ConfirmButton>}
        </StoreImageUploader>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Store Info</h1>
        <p className="mt-1 text-muted">This is what customers see on your store page.{" "}
          {store.status === "approved" && <Link href={`/stores/${store.slug}`} className="font-semibold text-brand pop hover:text-orange">View your store page</Link>}</p>
      </div>
      <section className="card grid gap-6 p-5 sm:grid-cols-2" aria-label="Store Images">
        {imageBlock("logo", store.logo_url, "Logo", "size-32")}
        {imageBlock("cover", store.cover_url, "Cover Photo", "aspect-[16/7] w-full")}
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-2xl">Details</h2>
          <VendorStoreForm store={store} />
        </section>
        <BusinessDocuments storeId={mine.id} userId={user.id} />
      </div>
      <p className="text-sm text-muted">Shipping fee, commission rate and your store&apos;s listing status are managed by LOOKBAN.</p>
    </div>
  );
}

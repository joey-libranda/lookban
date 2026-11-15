import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreForm } from "@/components/admin/StoreForm";
import { StoreImageUploader } from "@/components/admin/StoreImageUploader";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SafeImage } from "@/components/ui/SafeImage";
import { FormNotice } from "@/components/ui/Field";
import { getAdminStore } from "@/server/queries/admin";
import { deleteStoreAction, saveStoreAction, setStoreImageAction } from "@/server/actions/admin";
import { uuid } from "@/lib/validators/admin";

export const metadata: Metadata = { title: "Edit store · Admin" };

export default async function EditStore({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!uuid.safeParse(id).success) notFound();
  const store = await getAdminStore(id);
  if (!store) notFound();

  const imageBlock = (kind: "logo" | "cover", url: string | null, label: string, box: string) => (
    <div>
      <p className="label">{label}</p>
      <div className={`relative overflow-hidden rounded-lg bg-cream ${box}`}><SafeImage src={url} alt={`${store.name} ${kind}`} sizes="320px" compact={kind === "logo"} /></div>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        <StoreImageUploader storeId={id} kind={kind} />
        {url && <ConfirmButton className="text-sm font-semibold text-red-700 pop hover:text-red-900" confirm={`Remove the ${kind}?`} action={setStoreImageAction.bind(null, id, kind, null)}>Remove</ConfirmButton>}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/stores" className="text-sm font-semibold text-blue pop hover:text-orange">← Stores</Link>
      <h1 className="text-4xl">{store.name}</h1>
      {created && <FormNotice kind="success">Store created. Add its photos below, then add products.</FormNotice>}
      <section className="card grid gap-6 p-5 sm:grid-cols-2" aria-label="Store images">
        {imageBlock("logo", store.logo_url, "Logo", "size-32")}
        {imageBlock("cover", store.cover_url, "Cover photo", "aspect-[16/7] w-full")}
      </section>
      <section className="card p-5"><h2 className="mb-4 text-2xl">Details</h2>
        <StoreForm action={saveStoreAction.bind(null, id)} store={store} submitLabel="Save Changes" /></section>
      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div><h2 className="text-xl">Delete store</h2><p className="text-sm text-muted">Only possible when it has no products. Otherwise set it to Suspended.</p></div>
        <ConfirmButton action={deleteStoreAction.bind(null, id)} confirm="Permanently delete this store?" className="btn border-2 border-red-700 text-red-700 hover:bg-red-50">Delete Store</ConfirmButton>
      </section>
    </div>
  );
}

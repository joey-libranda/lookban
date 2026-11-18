import { DOC_STATUS_LABEL, DOC_STATUS_TONE, docStatus } from "@/lib/doc-status";
import { filesOf, getStoreDocuments } from "@/server/queries/documents";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreForm } from "@/components/admin/StoreForm";
import { StoreImageUploader } from "@/components/admin/StoreImageUploader";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SafeImage } from "@/components/ui/SafeImage";
import { FlashToast } from "@/components/ui/FlashToast";
import { getAdminStore } from "@/server/queries/admin";
import { deleteStoreAction, saveStoreAction, setStoreImageAction } from "@/server/actions/admin";
import { uuid } from "@/lib/validators/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit store · Admin" };

async function AdminStoreDocuments({ storeId }: { storeId: string }) {
  const doc = await getStoreDocuments(storeId);
  const files = doc ? await filesOf(doc) : [];
  const st = docStatus(doc?.permit_expiry);
  return (
    <section className="card space-y-3 p-5" aria-labelledby="sd-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sd-h" className="text-2xl">Business Documents</h2>
        <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${DOC_STATUS_TONE[st]}`}>{DOC_STATUS_LABEL[st]}</span>
      </div>
      {doc ? (
        <>
          <p className="text-sm">Permit {doc.permit_number} · valid until {doc.permit_expiry} · Registration {doc.registration_number}</p>
          <ul className="space-y-1">{files.map((f) => <li key={f.label} className="text-sm">{f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue hover:text-orange">{f.label}</a> : f.label}</li>)}</ul>
        </>
      ) : <p className="text-sm text-muted">No documents on file yet. The vendor can send them from their Store Info page.</p>}
      {st === "expired" && <p className="text-sm font-semibold text-red-700">The permit has expired. The store is still listed. Set it to Suspended below if you want to hide it.</p>}
    </section>
  );
}

export default async function EditStore({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!uuid.safeParse(id).success) notFound();
  const store = await getAdminStore(id);
  if (!store) notFound();

  // The store's vendor login (admins can read profiles).
  const { data: owner } = store.owner_id
    ? await (await createClient()).from("profiles").select("email, full_name").eq("id", store.owner_id).maybeSingle()
    : { data: null };

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
      {created && <FlashToast text="Store created. Add its photos below, then add products." />}
      <section className="card grid gap-6 p-5 sm:grid-cols-2" aria-label="Store Images">
        {imageBlock("logo", store.logo_url, "Logo", "size-32")}
        {imageBlock("cover", store.cover_url, "Cover photo", "aspect-[16/7] w-full")}
      </section>
      <section className="card p-5" aria-label="Vendor Login">
        <h2 className="text-2xl">Vendor Login</h2>
        {owner ? (
          <p className="mt-1 text-sm text-muted">This store signs in at <span className="font-semibold text-ink">/login</span> with <span className="font-semibold text-ink">{owner.email}</span> and manages its own products and orders from the Vendor Dashboard.</p>
        ) : (
          <p className="mt-1 text-sm text-muted">No vendor login yet. Run <code className="rounded bg-cream px-1">npm run vendors:create</code> on your computer to create one for every store that has none.</p>
        )}
      </section>
      <AdminStoreDocuments storeId={id} />
      <section className="card p-5"><h2 className="mb-4 text-2xl">Details</h2>
        <StoreForm action={saveStoreAction.bind(null, id)} store={store} submitLabel="Save Changes" /></section>
      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div><h2 className="text-xl">Delete Store</h2><p className="text-sm text-muted">Only possible when it has no products. Otherwise set it to Suspended.</p></div>
        <ConfirmButton action={deleteStoreAction.bind(null, id)} confirm="Permanently delete this store?" className="btn border-2 border-red-700 text-red-700 hover:bg-red-50">Delete Store</ConfirmButton>
      </section>
    </div>
  );
}

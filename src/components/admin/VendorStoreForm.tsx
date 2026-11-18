"use client";

import { ActionForm } from "./ActionForm";
import { Check, TextArea, TextInput } from "./Inputs";
import { saveVendorStoreAction } from "@/server/actions/admin";

type S = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

/** The part of the store page a vendor may edit. Web address, shipping fee, commission and approval stay with the admin. */
export function VendorStoreForm({ store }: { store: S }) {
  return (
    <ActionForm action={saveVendorStoreAction} submitLabel="Save Changes">
      {(e) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput placeholder="e.g. Lucban Delights" name="name" label="Store Name" defaultValue={s(store.name)} error={e.name} required maxLength={100} />
            <TextInput placeholder="Street, barangay, Lucban, Quezon" name="address" label="Address" defaultValue={s(store.address)} error={e.address} />
            <TextInput name="opening_hours" label="Opening Hours" defaultValue={s(store.opening_hours)} error={e.opening_hours} placeholder="Daily 7am - 7pm" />
            <TextInput placeholder="e.g. 09171234567" name="contact_phone" label="Contact Number" defaultValue={s(store.contact_phone)} error={e.contact_phone} />
            <TextInput placeholder="e.g. store@email.com" name="contact_email" label="Contact Email" type="email" defaultValue={s(store.contact_email)} error={e.contact_email} />
          </div>
          <TextArea placeholder="Tell customers about your store and what it is known for" name="description" label="Description" defaultValue={s(store.description)} error={e.description} rows={4} maxLength={1500} />
          <Check name="is_open" label="Store Is Open for Orders" defaultChecked={store.is_open !== false} />
        </>
      )}
    </ActionForm>
  );
}

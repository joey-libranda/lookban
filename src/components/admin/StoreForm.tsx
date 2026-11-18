"use client";

import { ActionForm } from "./ActionForm";
import { Check, Select, TextArea, TextInput } from "./Inputs";
import type { FormState } from "@/server/actions/admin";

type S = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

export function StoreForm({ action, store, submitLabel }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>; store?: S; submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel}>
      {(e) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput placeholder="e.g. Lucban Delights" name="name" label="Store Name" defaultValue={s(store?.name)} error={e.name} required maxLength={100} />
            <TextInput placeholder="e.g. lucban-delights" name="slug" label="Web Address (Optional)" defaultValue={s(store?.slug)} error={e.slug} hint="Blank = generated from the name." />
            <TextInput placeholder="Street, barangay, Lucban, Quezon" name="address" label="Address" defaultValue={s(store?.address)} error={e.address} />
            <TextInput name="opening_hours" label="Opening Hours" defaultValue={s(store?.opening_hours)} error={e.opening_hours} placeholder="Daily 7am - 7pm" />
            <TextInput placeholder="e.g. 09171234567" name="contact_phone" label="Contact Number" defaultValue={s(store?.contact_phone)} error={e.contact_phone} />
            <TextInput placeholder="e.g. store@email.com" name="contact_email" label="Contact Email" type="email" defaultValue={s(store?.contact_email)} error={e.contact_email} />
            <TextInput placeholder="Leave blank to use the default" name="shipping_fee" label="Shipping Fee (₱)" type="number" step="0.01" min="0" defaultValue={s(store?.shipping_fee)} error={e.shipping_fee}
              hint="Leave blank to use the default shipping fee from Settings." />
            <TextInput placeholder="Leave blank to use the default" name="commission_rate" label="Commission Rate (%)" type="number" step="0.01" min="0" max="100" defaultValue={s(store?.commission_rate)} error={e.commission_rate}
              hint="Leave blank to use the default rate from Settings. Changes apply to new orders only." />
            <Select name="status" label="Listing Status" defaultValue={s(store?.status ?? "approved")} error={e.status}>
              <option value="approved">Approved - visible to customers</option>
              <option value="pending">Pending - hidden</option>
              <option value="suspended">Suspended - hidden</option>
            </Select>
          </div>
          <TextArea placeholder="Tell customers about this store and what it is known for" name="description" label="Description" defaultValue={s(store?.description)} error={e.description} rows={4} />
          <Check name="is_open" label="Accepting Orders" defaultChecked={store ? !!store.is_open : true} hint="Untick to show the store as closed." />
        </>
      )}
    </ActionForm>
  );
}

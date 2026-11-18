"use client";

import { ActionForm } from "./ActionForm";
import { Select, TextArea, TextInput } from "./Inputs";
import type { FormState } from "@/server/actions/admin";

type P = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

/**
 * Admin and vendor use the same form. For a vendor (`vendor` prop) the store is fixed, there is no web-address field,
 * and the visibility choice only appears once the product has been approved.
 */
export function ProductForm({ action, product, stores, categories, submitLabel, vendor }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  product?: P;
  stores: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  submitLabel: string;
  vendor?: { storeId: string };
}) {
  // Until a product is approved its visibility is not editable: an admin approves it with the Approve button above the form.
  const isApproved = (product?.approval_status ?? "approved") === "approved";
  const approved = vendor ? !!product && isApproved : !product || isApproved;
  return (
    <ActionForm action={action} submitLabel={submitLabel}>
      {(e) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {vendor
              ? <input type="hidden" name="store_id" value={vendor.storeId} />
              : (
                <Select name="store_id" label="Store" defaultValue={s(product?.store_id)} error={e.store_id} required>
                  <option value="" disabled>Choose a Store…</option>
                  {stores.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </Select>
              )}
            <Select name="category_id" label="Category" defaultValue={s(product?.category_id)} error={e.category_id}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <TextInput placeholder="e.g. Longganisang Lucban, Garlic" name="name" label="Product Name" defaultValue={s(product?.name)} error={e.name} required maxLength={120} />
            <TextInput placeholder="e.g. Garlic, 250g" name="variant_label" label="Variant / Size Label" defaultValue={s(product?.variant_label)} error={e.variant_label}
              hint='e.g. "Garlic, 250g". Lets customers compare variants of the same product.' maxLength={60} />
            <TextInput placeholder="e.g. 120.00" name="price" label="Price (₱)" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={s(product?.price)} error={e.price} required />
            <TextInput placeholder="e.g. 150.00" name="compare_at_price" label="Original Price (₱), Optional" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={s(product?.compare_at_price)} error={e.compare_at_price} hint="For a promo: enter the higher, original price here and the discounted price above. Customers see it crossed out with a % OFF badge. Leave blank for no promo." />
            <TextInput placeholder="e.g. 50" name="stock" label="Stock on Hand" type="number" inputMode="numeric" step="1" min="0" defaultValue={s(product?.stock ?? 0)} error={e.stock} required />
          </div>
          <TextArea placeholder="Describe the product: taste, how it is made, what makes it special" name="description" label="Description" defaultValue={s(product?.description)} error={e.description} rows={4} maxLength={2000} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput name="weight" label="Weight" defaultValue={s(product?.weight)} error={e.weight} placeholder="250g" />
            <TextInput name="packaging" label="Packaging" defaultValue={s(product?.packaging)} error={e.packaging} placeholder="Vacuum pack" />
            <TextInput name="quantity_per_pack" label="Quantity per Pack" defaultValue={s(product?.quantity_per_pack)} error={e.quantity_per_pack} placeholder="1 dozen" />
          </div>
          <TextArea placeholder="e.g. Pork, garlic, vinegar, salt, pepper" name="ingredients" label="Ingredients" defaultValue={s(product?.ingredients)} error={e.ingredients} />
          <TextArea placeholder="e.g. Keep refrigerated. Best consumed within 7 days after opening." name="storage_instructions" label="Storage Instructions" defaultValue={s(product?.storage_instructions)} error={e.storage_instructions} />
          {approved ? (
            <div className="sm:w-1/2">
              <Select name="status" label="Visibility" defaultValue={s(product?.status ?? "active")} error={e.status}>
                <option value="active">Active - shown in the shop</option>
                <option value="archived">Archived - hidden from the shop</option>
              </Select>
            </div>
          ) : <input type="hidden" name="status" value="archived" />}
          {!vendor && (
            <TextInput placeholder="e.g. longganisang-lucban-garlic" name="slug" label="Web Address (Optional)" defaultValue={s(product?.slug)} error={e.slug}
              hint="Leave blank to generate from the name. Lowercase letters, numbers, dashes." />
          )}
        </>
      )}
    </ActionForm>
  );
}

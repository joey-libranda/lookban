"use client";

import { ActionForm } from "./ActionForm";
import { Select, TextArea, TextInput } from "./Inputs";
import type { FormState } from "@/server/actions/admin";

type P = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

export function ProductForm({ action, product, stores, categories, submitLabel }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  product?: P;
  stores: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel}>
      {(e) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select name="store_id" label="Store" defaultValue={s(product?.store_id)} error={e.store_id} required>
              <option value="" disabled>Choose a store…</option>
              {stores.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </Select>
            <Select name="category_id" label="Category" defaultValue={s(product?.category_id)} error={e.category_id}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <TextInput name="name" label="Product name" defaultValue={s(product?.name)} error={e.name} required maxLength={120} />
            <TextInput name="variant_label" label="Variant / size label" defaultValue={s(product?.variant_label)} error={e.variant_label}
              hint='e.g. "Garlic, 250g". Lets customers compare variants of the same product.' maxLength={60} />
            <TextInput name="price" label="Price (₱)" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={s(product?.price)} error={e.price} required />
            <TextInput name="compare_at_price" label="Original price (₱), optional" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={s(product?.compare_at_price)} error={e.compare_at_price} hint="For a promo: enter the higher, original price here and the discounted price above. Customers see it crossed out with a % OFF badge. Leave blank for no promo." />
            <TextInput name="stock" label="Stock on hand" type="number" inputMode="numeric" step="1" min="0" defaultValue={s(product?.stock ?? 0)} error={e.stock} required />
          </div>
          <TextArea name="description" label="Description" defaultValue={s(product?.description)} error={e.description} rows={4} maxLength={2000} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput name="weight" label="Weight" defaultValue={s(product?.weight)} error={e.weight} placeholder="250g" />
            <TextInput name="packaging" label="Packaging" defaultValue={s(product?.packaging)} error={e.packaging} placeholder="Vacuum pack" />
            <TextInput name="quantity_per_pack" label="Quantity per pack" defaultValue={s(product?.quantity_per_pack)} error={e.quantity_per_pack} placeholder="1 dozen" />
          </div>
          <TextArea name="ingredients" label="Ingredients" defaultValue={s(product?.ingredients)} error={e.ingredients} />
          <TextArea name="storage_instructions" label="Storage instructions" defaultValue={s(product?.storage_instructions)} error={e.storage_instructions} />
          <div className="sm:w-1/2">
            <Select name="status" label="Visibility" defaultValue={s(product?.status ?? "active")} error={e.status}>
              <option value="active">Active - shown in the shop</option>
              <option value="archived">Archived - hidden from the shop</option>
            </Select>
          </div>
          <TextInput name="slug" label="Web address (optional)" defaultValue={s(product?.slug)} error={e.slug}
            hint="Leave blank to generate from the name. Lowercase letters, numbers, dashes." />
        </>
      )}
    </ActionForm>
  );
}

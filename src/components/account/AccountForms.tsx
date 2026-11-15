"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { TextInput } from "@/components/admin/Inputs";
import { saveAddressAction, saveProfileAction } from "@/server/actions/admin";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  return (
    <ActionForm action={saveProfileAction} submitLabel="Save profile">
      {(e) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput name="full_name" label="Full name" defaultValue={fullName} error={e.full_name} required autoComplete="name" />
          <TextInput name="phone" label="Mobile number" defaultValue={phone} error={e.phone} autoComplete="tel" placeholder="09171234567" />
        </div>
      )}
    </ActionForm>
  );
}

type Addr = { recipient_name: string; phone: string; line1: string; barangay: string | null; city: string; province: string; postal_code: string | null } | null;

export function AddressForm({ address, fallbackName, fallbackPhone }: { address: Addr; fallbackName: string; fallbackPhone: string }) {
  return (
    <ActionForm action={saveAddressAction} submitLabel="Save address">
      {(e) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput name="full_name" label="Recipient name" defaultValue={address?.recipient_name ?? fallbackName} error={e.full_name} required />
          <TextInput name="phone" label="Mobile number" defaultValue={address?.phone ?? fallbackPhone} error={e.phone} required placeholder="09171234567" />
          <div className="sm:col-span-2"><TextInput name="line1" label="House no. / street" defaultValue={address?.line1 ?? ""} error={e.line1} required autoComplete="address-line1" /></div>
          <TextInput name="barangay" label="Barangay" defaultValue={address?.barangay ?? ""} error={e.barangay} />
          <TextInput name="city" label="City / municipality" defaultValue={address?.city ?? "Lucban"} error={e.city} required />
          <TextInput name="province" label="Province" defaultValue={address?.province ?? "Quezon"} error={e.province} required />
          <TextInput name="postal" label="Postal code" defaultValue={address?.postal_code ?? ""} error={e.postal} inputMode="numeric" maxLength={4} />
        </div>
      )}
    </ActionForm>
  );
}

"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { TextInput } from "@/components/admin/Inputs";
import { saveAddressAction, saveProfileAction } from "@/server/actions/admin";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  return (
    <ActionForm action={saveProfileAction} submitLabel="Save Profile">
      {(e) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput placeholder="e.g. Juan Dela Cruz" name="full_name" label="Full Name" defaultValue={fullName} error={e.full_name} required autoComplete="name" />
          <TextInput name="phone" label="Mobile Number" defaultValue={phone} error={e.phone} autoComplete="tel" placeholder="09171234567" />
        </div>
      )}
    </ActionForm>
  );
}

type Addr = { recipient_name: string; phone: string; line1: string; barangay: string | null; city: string; province: string; postal_code: string | null } | null;

export function AddressForm({ address, fallbackName, fallbackPhone }: { address: Addr; fallbackName: string; fallbackPhone: string }) {
  return (
    <ActionForm action={saveAddressAction} submitLabel="Save Address">
      {(e) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput placeholder="e.g. Juan Dela Cruz" name="full_name" label="Recipient Name" defaultValue={address?.recipient_name ?? fallbackName} error={e.full_name} required />
          <TextInput name="phone" label="Mobile Number" defaultValue={address?.phone ?? fallbackPhone} error={e.phone} required placeholder="09171234567" />
          <div className="sm:col-span-2"><TextInput placeholder="House no. and street, e.g. 12 Rizal St" name="line1" label="House No. / Street" defaultValue={address?.line1 ?? ""} error={e.line1} required autoComplete="address-line1" /></div>
          <TextInput placeholder="e.g. Brgy. Ayuti" name="barangay" label="Barangay" defaultValue={address?.barangay ?? ""} error={e.barangay} />
          <TextInput placeholder="e.g. Lucban" name="city" label="City / Municipality" defaultValue={address?.city ?? "Lucban"} error={e.city} required />
          <TextInput placeholder="e.g. Quezon" name="province" label="Province" defaultValue={address?.province ?? "Quezon"} error={e.province} required />
          <TextInput placeholder="e.g. 4328" name="postal" label="Postal Code" defaultValue={address?.postal_code ?? ""} error={e.postal} inputMode="numeric" maxLength={4} />
        </div>
      )}
    </ActionForm>
  );
}

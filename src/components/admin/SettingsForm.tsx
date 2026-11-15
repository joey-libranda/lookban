"use client";

import { ActionForm } from "./ActionForm";
import { TextInput } from "./Inputs";
import { saveSettingsAction } from "@/server/actions/admin";

export function SettingsForm({ fee }: { fee: number }) {
  return (
    <ActionForm action={saveSettingsAction} submitLabel="Save">
      {(e) => <TextInput name="default_shipping_fee" label="Default shipping fee per store (₱)" type="number" step="0.01" min="0" defaultValue={fee} error={e.default_shipping_fee} required />}
    </ActionForm>
  );
}

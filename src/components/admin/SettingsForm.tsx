"use client";

import { ActionForm } from "./ActionForm";
import { TextInput } from "./Inputs";
import { saveCommissionSettingAction, saveSettingsAction } from "@/server/actions/admin";

export function SettingsForm({ fee }: { fee: number }) {
  return (
    <ActionForm action={saveSettingsAction} submitLabel="Save">
      {(e) => <TextInput name="default_shipping_fee" label="Default Shipping Fee per Store (₱)" type="number" step="0.01" min="0" defaultValue={fee} error={e.default_shipping_fee} required />}
    </ActionForm>
  );
}

export function CommissionSettingForm({ rate }: { rate: number }) {
  return (
    <ActionForm action={saveCommissionSettingAction} submitLabel="Save">
      {(e) => <TextInput name="default_commission_rate" label="Default Commission Rate (%)" type="number" step="0.01" min="0" max="100" defaultValue={rate} error={e.default_commission_rate} required />}
    </ActionForm>
  );
}

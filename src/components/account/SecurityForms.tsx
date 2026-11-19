"use client";

import { useState, useTransition } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { TextInput } from "@/components/admin/Inputs";
import { useToast } from "@/components/ui/Toast";
import { changePasswordAction, deleteMyAccountAction, signOutEverywhereAction } from "@/server/actions/account";
import type { FormState } from "@/server/actions/admin";

export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} submitLabel="Change Password">
      {(e) => (
        <div className="grid gap-4 sm:max-w-md">
          <TextInput placeholder="Your current password" name="current_password" label="Current Password" type="password" autoComplete="current-password" error={e.current_password} required />
          <TextInput placeholder="Create a new password" name="password" label="New Password" type="password" autoComplete="new-password" error={e.password} required
            hint="At least 8 characters, with a letter and a number." />
          <TextInput placeholder="Type the new password again" name="confirm_password" label="Confirm New Password" type="password" autoComplete="new-password" error={e.confirm_password} required />
        </div>
      )}
    </ActionForm>
  );
}

export function SignOutEverywhere() {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button type="button" className="btn-outline" disabled={pending}
      onClick={() => {
        if (!window.confirm("Log out of LOOKBAN on every device, including this one?")) return;
        start(async () => {
          const r = await signOutEverywhereAction();
          if (r?.ok) window.location.replace("/login");
          else toast("error", r?.error ?? "Something went wrong.");
        });
      }}>
      {pending ? "Working…" : "Log Out of All Devices"}
    </button>
  );
}

/** Customers only. Asks for the password and the word DELETE; the server and the database re-check everything. */
export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const toast = useToast();

  if (!open) return <button type="button" className="btn border-2 border-red-700 text-red-700 hover:bg-red-50" onClick={() => setOpen(true)}>Delete My Account</button>;

  return (
    <form noValidate className="space-y-4 sm:max-w-md"
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        start(async () => {
          let res: FormState;
          try { res = await deleteMyAccountAction(null, fd); } catch { return toast("error", "Couldn't reach the server. Check your connection and try again."); }
          setErrors(res?.fieldErrors ?? {});
          if (res?.ok) { window.location.replace("/?account=deleted"); return; }
          if (res?.error) toast("error", res.error);
        });
      }}>
      <p className="text-sm">This permanently removes your login, saved address, cart and reviews. Your past orders stay on record for the stores that fulfilled them. This cannot be undone.</p>
      <TextInput placeholder="Your password" name="password" label="Your Password" type="password" autoComplete="current-password" error={errors.password} required />
      <TextInput placeholder="DELETE" name="confirm" label="Type DELETE to Confirm" autoComplete="off" error={errors.confirm} required />
      <div className="flex gap-3">
        <button type="submit" className="btn bg-danger text-white hover:bg-danger-700" disabled={pending}>{pending ? "Deleting…" : "Delete My Account"}</button>
        <button type="button" className="btn-outline" onClick={() => { setOpen(false); setErrors({}); }}>Keep My Account</button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { setCustomerActiveAction } from "@/server/actions/admin";

/** Deactivate (red) / Reactivate, each behind a confirmation. */
export function CustomerToggle({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`pop font-semibold ${active ? "text-red-700 hover:text-red-900" : "text-blue hover:text-orange"}`}>
        {active ? "Deactivate" : "Reactivate"}
      </button>
      <ConfirmModal open={open} busy={pending}
        title={active ? "Deactivate this customer?" : "Reactivate this customer?"}
        text={active ? `${name} will no longer be able to log in or place orders. You can reactivate the account later.` : `${name} will be able to log in and place orders again.`}
        confirmLabel={active ? "Yes, deactivate" : "Yes, reactivate"} cancelLabel="Cancel"
        confirmClass={active ? "bg-red-700 hover:bg-red-800" : "bg-blue hover:bg-blue-700"}
        onClose={() => setOpen(false)}
        onConfirm={() => start(async () => {
          try { await setCustomerActiveAction(id, !active); toast("success", active ? "Customer deactivated" : "Customer reactivated"); }
          catch { toast("error", "Couldn't update the customer. Try again."); }
          setOpen(false);
        })} />
    </>
  );
}

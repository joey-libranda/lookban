"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

/** "Empty cart" that asks first. `onEmpty` clears the cart (guest: this tab; customer: server action). */
export function EmptyCartButton({ onEmpty }: { onEmpty: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="mx-auto mt-4 flex items-center gap-1 text-sm font-semibold text-red-700 pop hover:text-red-900" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden /> Empty cart
      </button>
      <ConfirmModal open={open} busy={pending} title="Empty your cart?" text="All items will be removed from your cart. This can't be undone."
        confirmLabel="Yes, empty cart" cancelLabel="Keep my items" onClose={() => setOpen(false)}
        onConfirm={() => start(async () => { await onEmpty(); setOpen(false); })} />
    </>
  );
}

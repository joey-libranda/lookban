"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean; title: string; text: string; confirmLabel: string; cancelLabel?: string;
  onConfirm: () => void; onClose: () => void; busy?: boolean; confirmClass?: string;
};

/** Small "are you sure?" dialog (native <dialog>: focus trap, Esc to close). Controlled by the parent. */
export function ConfirmModal({ open, title, text, confirmLabel, cancelLabel = "Cancel", onConfirm, onClose, busy, confirmClass = "bg-red-700 hover:bg-red-800" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby="confirm-title" onClose={onClose}
            className="m-auto w-[min(92vw,24rem)] rounded-xl text-left p-6 shadow-xl backdrop:bg-black/40">
      <h2 id="confirm-title" className="text-2xl">{title}</h2>
      <p className="mt-2 text-sm text-muted">{text}</p>
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className="btn-outline !py-2" onClick={onClose}>{cancelLabel}</button>
        <button type="button" disabled={busy} className={`btn !py-2 text-white ${confirmClass}`} onClick={onConfirm}>{busy ? "Working…" : confirmLabel}</button>
      </div>
    </dialog>
  );
}

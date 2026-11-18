"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewProductAction } from "@/server/actions/admin";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";

/** Approve or reject a product a store submitted. Approving publishes it to the shop; rejecting needs a reason. */
export function ProductReview({ id, name, storeName }: { id: string; name: string; storeName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const run = (decision: "approve" | "reject") => start(async () => {
    setNoteError("");
    const fd = new FormData(); fd.set("note", note);
    const r = await reviewProductAction(id, decision, null, fd);
    setConfirm(false);
    if (r?.ok) { toast("success", r.message ?? "Done."); router.refresh(); }
    else { setNoteError(r?.fieldErrors?.note ?? ""); toast("error", r?.error ?? "Could not save your decision."); }
  });

  return (
    <section className="rounded-xl border-2 border-orange bg-yellow/30 p-5" aria-labelledby="review-h">
      <h2 id="review-h" className="text-2xl">Needs Your Approval</h2>
      <p className="mt-1 text-sm">{storeName} added this product. It stays hidden from the shop until you approve it. Check the photos, price and details below first.</p>
      <div className="mt-3">
        <label htmlFor="review-note" className="label">Note to the Store</label>
        <textarea id="review-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="input" aria-invalid={!!noteError}
          placeholder="Required when sending it back, e.g. “Please add a clear photo and the weight.”" />
        {noteError && <p role="alert" className="field-error">{noteError}</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={pending} onClick={() => setConfirm(true)} className="btn-primary">Approve Product</button>
        <button type="button" disabled={pending} onClick={() => run("reject")} className="btn border-2 border-red-700 bg-white text-red-700 hover:bg-red-50">Send Back With Note</button>
      </div>
      <ConfirmModal open={confirm} busy={pending} title="Approve this product?" confirmLabel="Approve" confirmClass="bg-blue hover:bg-blue-700"
        text={`“${name}” will go live in the shop right away.`} onConfirm={() => run("approve")} onClose={() => setConfirm(false)} />
    </section>
  );
}

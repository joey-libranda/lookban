"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { cancelStoreOrderAction, confirmReceivedAction, rateStoreOrderAction } from "@/server/actions/customer-orders";
import type { FulfillmentStatus } from "@/types/db";

type Props = {
  orderId: string; storeOrderId: string; storeName: string; status: FulfillmentStatus;
  rating: number | null; canRate: boolean; token?: string;
  /** What happens to the money if this store's part is cancelled (computed on the server). */
  cancelNote: string;
};

/** Customer buttons for ONE store's part of an order: cancel, "Mark as Received", rate. */
export function StoreOrderActions({ orderId, storeOrderId, storeName, status, rating, canRate, token, cancelNote }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | "cancel" | "received">(null);
  const [rateOpen, setRateOpen] = useState(false);

  const canCancel = status === "pending" || status === "confirmed" || status === "preparing";
  const canConfirm = status === "out_for_delivery";
  const canRateNow = status === "delivered" && rating === null && canRate;
  if (!canCancel && !canConfirm && !canRateNow) return null;

  function run() {
    const kind = confirm;
    start(async () => {
      const res = kind === "cancel"
        ? await cancelStoreOrderAction(orderId, storeOrderId, token)
        : await confirmReceivedAction(orderId, storeOrderId, token);
      setConfirm(null);
      if (!res.ok) { toast("error", res.error); return; }
      toast("success", res.message);
      if (kind === "received" && canRate) setRateOpen(true); // straight on to the rating
    });
  }

  return (
    <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-4">
      {canCancel && <button type="button" className="btn-outline !border-red-700 !py-2 !text-red-700 hover:!bg-red-50" onClick={() => setConfirm("cancel")}>Cancel This Order</button>}
      {canConfirm && <button type="button" className="btn-primary !py-2" onClick={() => setConfirm("received")}>Mark as Received</button>}
      {canRateNow && <button type="button" className="btn-primary !py-2" onClick={() => setRateOpen(true)}>Rate This Order</button>}

      <ConfirmModal
        open={confirm === "cancel"} busy={pending} onClose={() => setConfirm(null)} onConfirm={run}
        title="Cancel This Order?" text={`Your items from ${storeName} will be cancelled. ${cancelNote} This cannot be undone.`}
        confirmLabel="Yes, Cancel Order" cancelLabel="Keep Order" />
      <ConfirmModal
        open={confirm === "received"} busy={pending} onClose={() => setConfirm(null)} onConfirm={run}
        title="Did You Receive It?" text={`Confirm only if your items from ${storeName} have arrived. The store's order will be marked as delivered.`}
        confirmLabel="Yes, I Received It" cancelLabel="Not Yet" confirmClass="bg-orange hover:bg-orange-600" />
      {canRate && status === "delivered" && <RatingDialog open={rateOpen} onClose={() => setRateOpen(false)} orderId={orderId} storeOrderId={storeOrderId} storeName={storeName} />}
    </div>
  );
}

function RatingDialog({ open, onClose, orderId, storeOrderId, storeName }:
  { open: boolean; onClose: () => void; orderId: string; storeOrderId: string; storeName: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function submit() {
    if (stars < 1) { setError("Please choose 1 to 5 stars."); return; }
    setError("");
    start(async () => {
      const res = await rateStoreOrderAction(orderId, storeOrderId, stars, comment);
      if (!res.ok) { setError(res.error); return; }
      toast("success", res.message);
      onClose();
    });
  }

  const shown = hover || stars;
  return (
    <dialog ref={ref} aria-labelledby="rate-title" onClose={onClose}
            className="m-auto w-[min(92vw,26rem)] rounded-xl p-6 text-left shadow-xl backdrop:bg-black/40">
      <h2 id="rate-title" className="text-2xl">How Was Your Order?</h2>
      <p className="mt-1 text-sm text-muted">Rate your order from {storeName}.</p>
      <div className="mt-4 flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => setStars(n)} onMouseEnter={() => setHover(n)}
                  className="rounded p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue">
            <Star className={`size-9 ${n <= shown ? "fill-orange text-orange" : "text-line"}`} aria-hidden />
          </button>
        ))}
      </div>
      <label htmlFor="rate-comment" className="label mt-4">Feedback <span className="font-normal text-muted">(optional)</span></label>
      <textarea id="rate-comment" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us what you liked or what could be better." className="input" />
      {error && <p role="alert" className="field-error">{error}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className="btn-outline !py-2" onClick={onClose}>Maybe Later</button>
        <button type="button" disabled={pending} className="btn-primary !py-2" onClick={submit}>{pending ? "Sending…" : "Submit Rating"}</button>
      </div>
    </dialog>
  );
}

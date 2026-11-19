"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { cancelReturnAction, completeReturnAction, escalateReturnAction, respondReturnAction, type RetResult } from "@/server/actions/returns";

function useRun() {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<RetResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) { toast("success", r.message); after?.(); router.refresh(); } else toast("error", r.error);
    });
  return { pending, run };
}

/** Customer: withdraw a waiting request, or ask LOOKBAN to look again at a store's rejection (once). */
export function CustomerReturnActions({ id, status, escalated }: { id: string; status: string; escalated: boolean }) {
  const { pending, run } = useRun();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const canEscalate = status === "rejected" && !escalated;
  if (status !== "requested" && !canEscalate) return null;
  return (
    <section className="card p-5" aria-label="Your options">
      {status === "requested" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Changed your mind or solved it with the store? You can withdraw this request.</p>
          <button type="button" className="btn-outline" disabled={pending} onClick={() => run(() => cancelReturnAction(id))}>Withdraw Request</button>
        </div>
      )}
      {canEscalate && (
        <div>
          <h2 className="text-xl">Disagree With the Store?</h2>
          <p className="mt-1 text-sm text-muted">You can ask LOOKBAN to review this once. LOOKBAN&apos;s decision is final.</p>
          {!open ? <button type="button" className="btn-primary mt-3" onClick={() => setOpen(true)}>Ask LOOKBAN to Review</button> : (
            <div className="mt-3 space-y-3">
              <label htmlFor="esc-note" className="label">Why Should It Be Reviewed?</label>
              <textarea id="esc-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Explain what the store missed." />
              <div className="flex gap-3">
                <button type="button" className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
                <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => escalateReturnAction(id, note))}>Send to LOOKBAN</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Store (or admin, when escalated): approve or decline. */
export function ReviewReturnForm({ id, desired, shippingFee, paidOnline, who }: { id: string; desired: "refund" | "replacement"; shippingFee: number; paidOnline: boolean; who: "store" | "admin" }) {
  const { pending, run } = useRun();
  const [resolution, setResolution] = useState<"refund" | "replacement">(desired);
  const [shipping, setShipping] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  function reject() {
    if (note.trim().length < 5) { setError("Please give a reason (at least 5 characters)"); return; }
    setError(""); run(() => respondReturnAction(id, "reject", note, resolution, false));
  }
  return (
    <section className="card space-y-4 p-5" aria-labelledby="rv-h">
      <h2 id="rv-h" className="text-2xl">{who === "admin" ? "LOOKBAN Decision" : "Your Decision"}</h2>
      <div>
        <p className="label">If You Approve</p>
        <div className="flex flex-wrap gap-3">
          {(["refund", "replacement"] as const).map((d) => (
            <label key={d} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-blue-50">
              <input type="radio" name="resolution" checked={resolution === d} onChange={() => setResolution(d)} className="accent-[var(--lb-orange)]" />
              {d === "refund" ? "Refund" : "Send a Replacement"}
            </label>
          ))}
        </div>
        {resolution === "refund" && shippingFee > 0 && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={shipping} onChange={(e) => setShipping(e.target.checked)} className="accent-[var(--lb-orange)]" />
            Also refund the shipping fee
          </label>
        )}
        {resolution === "refund" && <p className="mt-2 text-xs text-muted">{paidOnline ? "The customer paid online." : "The customer paid cash on delivery."} After you send the money, record it as completed.</p>}
      </div>
      <div>
        <label htmlFor="rv-note" className="label">Note to the Customer</label>
        <textarea id="rv-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Required if you decline." aria-invalid={!!error} />
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => respondReturnAction(id, "approve", note, resolution, resolution === "refund" && shipping))}>Approve</button>
        <button type="button" className="btn-outline" disabled={pending} onClick={reject}>Decline</button>
      </div>
    </section>
  );
}

/** Store/admin: record that the refund was sent, or the replacement shipped. */
export function CompleteReturnForm({ id, resolution }: { id: string; resolution: "refund" | "replacement" | null }) {
  const { pending, run } = useRun();
  const [ref, setRef] = useState("");
  const [error, setError] = useState("");
  const refund = resolution === "refund";
  function go() {
    if (refund && ref.trim().length < 3) { setError("Enter the payment reference (at least 3 characters)"); return; }
    setError(""); run(() => completeReturnAction(id, ref));
  }
  return (
    <section className="card space-y-3 p-5" aria-labelledby="cp-h">
      <h2 id="cp-h" className="text-2xl">{refund ? "Record the Refund" : "Record the Replacement"}</h2>
      <p className="text-sm text-muted">{refund ? "Send the money outside LOOKBAN (GCash, bank or cash), then enter the reference here." : "Mark this once the replacement has been sent. Stock is not changed automatically."}</p>
      <div>
        <label htmlFor="cp-ref" className="label">{refund ? "Payment Reference" : "Tracking or Note (Optional)"}</label>
        <input id="cp-ref" className="input" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} placeholder={refund ? "e.g. GCash ref 1234567890" : "e.g. Sent by J&T on Nov 20"} aria-invalid={!!error} />
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
      <button type="button" className="btn-primary" disabled={pending} onClick={go}>Mark as Completed</button>
    </section>
  );
}

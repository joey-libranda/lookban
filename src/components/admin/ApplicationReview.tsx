"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveApplicationAction, rejectApplicationAction } from "@/server/actions/applications";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";

/** Note box + Approve / Reject. Rejecting needs a reason (the applicant sees it and may apply again). */
export function ApplicationReview({ id, storeName, canApprove }: { id: string; storeName: string; canApprove: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: typeof approveApplicationAction) => start(async () => {
    const r = await fn(id, note);
    setConfirm(false);
    if (r.ok) { toast("success", r.message); router.refresh(); } else toast("error", r.error);
  });

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      <div>
        <label htmlFor={`note-${id}`} className="label">Note to Applicant</label>
        <textarea id={`note-${id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="input"
          placeholder="Required when rejecting, e.g. “The permit photo is blurry, please upload a clear copy.”" />
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={pending || !canApprove} onClick={() => setConfirm(true)} className="btn-primary disabled:opacity-50">Approve Application</button>
        <button type="button" disabled={pending} onClick={() => run(rejectApplicationAction)} className="btn border-2 border-red-700 text-red-700 hover:bg-red-50">Reject</button>
      </div>
      {!canApprove && <p className="text-sm text-red-700">Approval is blocked: the permit has expired or a required document is missing. Reject with a reason so the applicant can fix it.</p>}
      <ConfirmModal open={confirm} busy={pending} title="Approve this store?" confirmClass="bg-blue hover:bg-blue-700" confirmLabel="Approve"
        text={`This creates the store “${storeName}” and gives the applicant a Vendor Dashboard. Make sure you checked their documents.`}
        onConfirm={() => run(approveApplicationAction)} onClose={() => setConfirm(false)} />
    </div>
  );
}

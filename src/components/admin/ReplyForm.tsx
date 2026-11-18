"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { sendReplyAction, type FormState } from "@/server/actions/admin";

/** Reply box. The reply is saved and shown in the conversation. (The prototype has no mail service: see the note in the server action.) */
export function ReplyForm({ messageId, toEmail, again }: { messageId: string; toEmail: string; again: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const err = state?.fieldErrors?.body;

  return (
    <form ref={ref} noValidate className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            const res = await sendReplyAction(messageId, null, fd);
            setState(res);
            if (res?.ok) { toast("success", res.message ?? "Reply sent."); ref.current?.reset(); router.refresh(); }
            else if (res?.error) toast("error", res.error);
          } catch { toast("error", "Couldn't reach the server. Try again."); }
        });
      }}>
      <h2 className="text-xl">{again ? "Send Another Reply" : "Reply"}</h2>
      <p className="text-sm text-muted">To: <span className="break-all font-semibold text-ink">{toEmail}</span></p>
      <div>
        <label htmlFor="body" className="sr-only">Your reply</label>
        <textarea id="body" name="body" rows={6} maxLength={2000} className="input" placeholder="Type your reply..." aria-invalid={!!err} />
        {err && <p role="alert" className="field-error">{err}</p>}
      </div>
      <div className="flex justify-end"><button type="submit" className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Send Reply"}</button></div>
    </form>
  );
}

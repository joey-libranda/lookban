"use client";

import { useState, useTransition } from "react";
import { sendContactMessageAction } from "@/server/actions/contact";
import { CONTACT_SUBJECTS } from "@/lib/validators/contact";
import { useToast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/Select";

/** Contact form. Typed values are kept if sending fails; the form clears only after success. */
export function ContactForm() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const err = (k: string) => errors[k] && <p role="alert" className="field-error">{errors[k]}</p>;

  return (
    <form noValidate className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      start(async () => {
        setErrors({}); setFormError("");
        try {
          const r = await sendContactMessageAction({
            name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""),
            subject: String(fd.get("subject") ?? "") as never, message: String(fd.get("message") ?? ""),
            website: String(fd.get("website") ?? ""),
          });
          if (r.ok) { form.reset(); toast("success", "Message sent. We'll get back to you soon."); }
          else { setErrors(r.fieldErrors ?? {}); setFormError(r.fieldErrors ? "" : r.error); }
        } catch {
          setFormError("Couldn't reach the server. Check your connection and try again.");
        }
      });
    }}>
      <div>
        <label htmlFor="c-name" className="label">Full Name</label>
        <input id="c-name" name="name" autoComplete="name" placeholder="Juan dela Cruz" className="input" aria-invalid={!!errors.name} />
        {err("name")}
      </div>
      <div>
        <label htmlFor="c-email" className="label">Email Address</label>
        <input id="c-email" name="email" type="email" autoComplete="email" placeholder="juan@email.com" className="input" aria-invalid={!!errors.email} />
        {err("email")}
      </div>
      <div>
        <label htmlFor="c-subject" className="label">Subject</label>
        <Select id="c-subject" name="subject" defaultValue="" aria-invalid={!!errors.subject}>
          <option value="" disabled>Select a subject</option>
          {CONTACT_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        {err("subject")}
      </div>
      <div>
        <label htmlFor="c-message" className="label">Message</label>
        <textarea id="c-message" name="message" rows={5} placeholder="Write your message here…" className="input" aria-invalid={!!errors.message} />
        {err("message")}
      </div>
      <div className="absolute -left-[9999px]" aria-hidden>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "Sending…" : "Send Message"}</button>
    </form>
  );
}

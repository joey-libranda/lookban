"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { PROOF_MAX_BYTES, PROOF_TYPES } from "@/lib/validators/application";
import { documentUpdateSchema } from "@/lib/validators/documents";
import { submitDocumentRequestAction } from "@/server/actions/documents";

type Key = "permit" | "registration" | "sanitary";

/**
 * Ask LOOKBAN to change the documents on file (e.g. a renewed permit). Leave a field empty to keep it as it is.
 * Files go to the vendor's own PRIVATE folder first; nothing on file changes until an admin approves.
 */
export function DocumentUpdateForm({ userId, hasRecord }: { userId: string; hasRecord: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const files = useRef<Record<Key, File | null>>({ permit: null, registration: null, sanitary: null });
  const formRef = useRef<HTMLFormElement>(null);

  const err = (k: string) => errors[k] && <p role="alert" className="field-error">{errors[k]}</p>;
  const field = (k: string, label: string, props: React.ComponentProps<"input"> = {}) => (
    <div>
      <label htmlFor={`d-${k}`} className="label">{label}</label>
      <input id={`d-${k}`} name={k} className="input" aria-invalid={!!errors[k]} {...props} />
      {err(k)}
    </div>
  );
  const fileField = (k: Key, label: string) => (
    <div>
      <p className="label">{label}</p>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line bg-white px-3 py-3 hover:bg-blue-50">
        <FileCheck2 className="size-5 shrink-0 text-blue" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm">{names[k] ?? <span className="text-muted">{hasRecord ? "Keep current file" : "PDF or photo, up to 5 MB"}</span>}</span>
        <span className="btn-outline !px-3 !py-1 !text-sm">{names[k] ? "Change" : "Choose File"}</span>
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && !PROOF_TYPES[f.type]) { setErrors((x) => ({ ...x, [k]: "Upload a PDF, JPG, PNG or WebP file." })); e.target.value = ""; return; }
            if (f && f.size > PROOF_MAX_BYTES) { setErrors((x) => ({ ...x, [k]: "The file is larger than 5 MB." })); e.target.value = ""; return; }
            setErrors((x) => { const { [k]: _d, ...rest } = x; void _d; return rest; });
            files.current[k] = f; setNames((n) => ({ ...n, [k]: f?.name ?? "" }));
          }} />
      </label>
      {err(k)}
    </div>
  );

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "");
    start(async () => {
      setErrors({});
      const parsed = documentUpdateSchema.safeParse({
        permit_number: get("permit_number"), permit_expiry: get("permit_expiry"), registration_number: get("registration_number"), vendor_note: get("vendor_note"),
      });
      if (!parsed.success) {
        const found: Record<string, string> = {};
        for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
        setErrors(found); toast("error", "Please fix the highlighted fields."); return;
      }
      const v = parsed.data;
      const nothing = !v.permit_number && !v.permit_expiry && !v.registration_number && !files.current.permit && !files.current.registration && !files.current.sanitary;
      if (nothing) { toast("error", "Change at least one thing before sending an update."); return; }
      if (!hasRecord && !(v.permit_number && v.permit_expiry && v.registration_number && files.current.permit && files.current.registration)) {
        toast("error", "Your store has no documents on file yet. Fill in every field and upload both files."); return;
      }

      const supabase = createClient();
      const uploaded: string[] = [];
      const up = async (file: File | null) => {
        if (!file) return undefined;
        const path = `${userId}/${crypto.randomUUID()}.${PROOF_TYPES[file.type]}`;
        const { error } = await supabase.storage.from("vendor-documents").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error(`${file.name}: ${error.message}`);
        uploaded.push(path); return path;
      };
      try {
        const permit_path = await up(files.current.permit);
        const registration_path = await up(files.current.registration);
        const sanitary_path = await up(files.current.sanitary);
        const r = await submitDocumentRequestAction({ ...v, permit_path, registration_path, sanitary_path });
        if (!r.ok) {
          if (uploaded.length) await supabase.storage.from("vendor-documents").remove(uploaded);
          setErrors(r.fieldErrors ?? {}); toast("error", r.error); return;
        }
        toast("success", r.message);
        formRef.current?.reset(); files.current = { permit: null, registration: null, sanitary: null }; setNames({});
        router.refresh();
      } catch (ex) {
        if (uploaded.length) await supabase.storage.from("vendor-documents").remove(uploaded);
        toast("error", ex instanceof Error ? ex.message : "Couldn't upload your documents. Check your connection and try again.");
      }
    });
  }

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">{hasRecord ? "Only fill in what changed, for example a renewed permit. Everything else stays as it is." : "Send your permit and registration so LOOKBAN can put them on file."}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("permit_number", "Business / Mayor's Permit No.", { placeholder: "e.g. BP-2026-0042" })}
        {field("permit_expiry", "Permit Valid Until", { type: "date", min: new Date().toISOString().slice(0, 10) })}
      </div>
      {fileField("permit", "Business / Mayor's Permit")}
      {field("registration_number", "DTI / SEC / CDA Registration No.", { placeholder: "e.g. DTI-4455667" })}
      {fileField("registration", "DTI / SEC / CDA Registration")}
      {fileField("sanitary", "Sanitary Permit or FDA License")}
      <div>
        <label htmlFor="d-note" className="label">Note for LOOKBAN (Optional)</label>
        <textarea id="d-note" name="vendor_note" rows={2} maxLength={500} className="input" placeholder="e.g. Renewed permit for 2027." />
        {err("vendor_note")}
      </div>
      <button type="submit" disabled={pending} className="btn-primary">{pending ? "Sending…" : "Send for Approval"}</button>
    </form>
  );
}

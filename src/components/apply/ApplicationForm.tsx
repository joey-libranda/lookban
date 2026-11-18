"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitApplicationAction } from "@/server/actions/applications";
import { applicationFieldsSchema, PROOF_MAX_BYTES, PROOF_TYPES } from "@/lib/validators/application";
import { useToast } from "@/components/ui/Toast";

type Defaults = Partial<Record<"store_name" | "description" | "address" | "owner_name" | "contact_email" | "phone" | "permit_number" | "registration_number", string>>;

/**
 * Store application. The proof files go straight from the browser into the applicant's PRIVATE folder
 * (bucket vendor-documents); then the server action records the application. Typed values are kept if anything fails.
 */
export function ApplicationForm({ userId, defaults = {} }: { userId: string; defaults?: Defaults }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const files = useRef<Record<string, File | null>>({ permit: null, registration: null, sanitary: null });

  const err = (k: string) => errors[k] && <p id={`${k}-err`} role="alert" className="field-error">{errors[k]}</p>;
  const field = (k: string, label: string, props: React.ComponentProps<"input"> = {}) => (
    <div>
      <label htmlFor={`a-${k}`} className="label">{label}</label>
      <input id={`a-${k}`} name={k} defaultValue={defaults[k as keyof Defaults]} className="input" aria-invalid={!!errors[k]} {...props} />
      {err(k)}
    </div>
  );
  const fileField = (k: "permit" | "registration" | "sanitary", label: string, required: boolean, hint: string) => (
    <div>
      <p className="label">{label}{required ? "" : " (optional)"}</p>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line bg-white px-3 py-3 hover:bg-blue-50">
        <FileCheck2 className="size-5 shrink-0 text-blue" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm">{names[k] ?? <span className="text-muted">{hint}</span>}</span>
        <span className="btn-outline !px-3 !py-1 !text-sm">{names[k] ? "Change" : "Choose File"}</span>
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && !PROOF_TYPES[f.type]) { setErrors((x) => ({ ...x, [k]: "Upload a PDF, JPG, PNG or WebP file." })); e.target.value = ""; return; }
            if (f && f.size > PROOF_MAX_BYTES) { setErrors((x) => ({ ...x, [k]: "The file is larger than 5 MB." })); e.target.value = ""; return; }
            setErrors((x) => { const { [k]: _drop, ...rest } = x; void _drop; return rest; });
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
      // 1) check the typed business information and the required files BEFORE uploading anything
      const fields = applicationFieldsSchema.safeParse({
        store_name: get("store_name"), description: get("description"), address: get("address"), owner_name: get("owner_name"),
        contact_email: get("contact_email"), phone: get("phone"), permit_number: get("permit_number"),
        permit_expiry: get("permit_expiry"), registration_number: get("registration_number"),
      });
      const found: Record<string, string> = {};
      if (!fields.success) for (const i of fields.error.issues) found[String(i.path[0])] ??= i.message;
      if (!files.current.permit) found.permit = "Upload your Business / Mayor's Permit.";
      if (!files.current.registration) found.registration = "Upload your DTI / SEC / CDA registration.";
      if (fd.get("confirm") !== "on") found.confirm = "Please confirm that the information is true.";
      if (Object.keys(found).length || !fields.success) { setErrors(found); toast("error", "Please fix the highlighted fields."); return; }

      // 2) upload the proof files into this applicant's private folder
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
        // 3) record the application (the server and the database re-check everything)
        const r = await submitApplicationAction({ ...fields.data, permit_path: permit_path!, registration_path: registration_path!, sanitary_path, confirm: true });
        if (!r.ok) {
          await supabase.storage.from("vendor-documents").remove(uploaded); // don't leave orphan files
          setErrors(r.fieldErrors ?? {}); toast("error", r.error); return;
        }
        toast("success", r.message);
        router.refresh();
      } catch (ex) {
        if (uploaded.length) await supabase.storage.from("vendor-documents").remove(uploaded);
        toast("error", ex instanceof Error ? ex.message : "Couldn't upload your documents. Check your connection and try again.");
      }
    });
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="mb-1 text-2xl">Store Information</legend>
        {field("store_name", "Store Name", { placeholder: "e.g. Lucban Delights", autoComplete: "organization" })}
        <div>
          <label htmlFor="a-description" className="label">What Do You Sell?</label>
          <textarea id="a-description" name="description" rows={4} defaultValue={defaults.description} className="input" aria-invalid={!!errors.description}
            placeholder="Tell customers about your store and your pasalubong products (at least 20 characters)." />
          {err("description")}
        </div>
        {field("address", "Business Address", { placeholder: "Street, barangay, Lucban, Quezon", autoComplete: "street-address" })}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-2xl">Owner and Contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("owner_name", "Owner's Full Name", { placeholder: "e.g. Ana Reyes", autoComplete: "name" })}
          {field("phone", "Contact Number", { type: "tel", placeholder: "09171234567", autoComplete: "tel" })}
        </div>
        {field("contact_email", "Business Email", { type: "email", placeholder: "store@email.com", autoComplete: "email" })}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-2xl">Proof of Business</legend>
        <p className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-ink">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
          Your documents are stored privately and can only be opened by LOOKBAN administrators. We use them only to verify your business.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("permit_number", "Business / Mayor's Permit No.", { placeholder: "e.g. BP-2026-0042" })}
          {field("permit_expiry", "Permit Valid Until", { type: "date", min: new Date().toISOString().slice(0, 10) })}
        </div>
        {fileField("permit", "Business / Mayor's Permit", true, "PDF or photo, up to 5 MB")}
        {field("registration_number", "DTI / SEC / CDA Registration No.", { placeholder: "e.g. DTI-4455667" })}
        {fileField("registration", "DTI / SEC / CDA Registration", true, "PDF or photo, up to 5 MB")}
        {fileField("sanitary", "Sanitary Permit or FDA License", false, "Recommended for food products")}
      </fieldset>

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="confirm" className="mt-0.5 size-4 accent-[var(--lb-blue)]" />
          <span>I confirm that the information and documents I submitted are true and belong to my business.</span>
        </label>
        {err("confirm")}
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">{pending ? "Submitting…" : "Submit Application"}</button>
    </form>
  );
}

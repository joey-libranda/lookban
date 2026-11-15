"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { FormState } from "@/server/actions/admin";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type Props = {
  bucket: "product-images" | "store-assets" | "hero-banners";
  /** Folder = the store id (or "slides" for hero photos). Storage policies only allow admins/store owners to write here. */
  folder: string;
  /** Records the uploaded file server-side (the server re-checks the path). */
  onUploaded: (path: string) => Promise<FormState>;
  label: string;
  multiple?: boolean;
};

/**
 * Uploads straight from the browser to Supabase Storage (so large photos bypass Vercel's request limit),
 * after checking type and size client-side. The bucket itself enforces the same limits and the
 * server action verifies the path - client checks are only for friendly feedback.
 */
export function ImageUploader({ bucket, folder, onUploaded, label, multiple }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    const supabase = createClient();
    let okCount = 0; let firstError = "";
    for (const file of Array.from(files)) {
      const ext = TYPES[file.type];
      if (!ext) { firstError ||= `${file.name}: only JPG, PNG or WebP photos are allowed.`; continue; }
      if (file.size > MAX_BYTES) { firstError ||= `${file.name}: photo is larger than 5 MB.`; continue; }
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (error) { firstError ||= `${file.name}: ${error.message}`; continue; }
      const res = await onUploaded(path);
      if (!res?.ok) {
        await supabase.storage.from(bucket).remove([path]); // don't leave orphans
        firstError ||= res?.error ?? "Could not save the photo.";
        continue;
      }
      okCount++;
    }
    setBusy(false);
    if (ref.current) ref.current.value = "";
    setMsg(firstError ? { ok: false, text: firstError } : { ok: true, text: `${okCount} photo${okCount === 1 ? "" : "s"} uploaded.` });
    if (okCount) router.refresh();
  }

  return (
    <div>
      <label className="btn-outline cursor-pointer">
        {busy ? "Uploading…" : label}
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} className="sr-only"
               disabled={busy} onChange={(e) => handle(e.target.files)} />
      </label>
      <p className="mt-1 text-xs text-muted">JPG, PNG or WebP, up to 5 MB.</p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-1 text-sm ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}

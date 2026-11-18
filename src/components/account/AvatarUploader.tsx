"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Avatar } from "@/components/account/Avatar";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { removeAvatarAction, setAvatarAction } from "@/server/actions/account";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Uploads straight to the "avatars" bucket (own folder only), then the server records the path. */
export function AvatarUploader({ userId, path, name, email }: { userId: string; path: string | null; name: string | null; email: string | null }) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    const ext = TYPES[file.type];
    if (!ext) return toast("error", "Use a JPG, PNG or WebP photo.");
    if (file.size > MAX_BYTES) return toast("error", "That photo is larger than 2 MB.");
    setBusy(true);
    const supabase = createClient();
    const newPath = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(newPath, file, { contentType: file.type, upsert: false });
    if (error) { setBusy(false); return toast("error", `Could not upload the photo: ${error.message}`); }
    const res = await setAvatarAction(newPath);
    if (!res?.ok) await supabase.storage.from("avatars").remove([newPath]); // no orphans
    setBusy(false);
    if (ref.current) ref.current.value = "";
    toast(res?.ok ? "success" : "error", (res?.ok ? res.message : res?.error) ?? "");
    if (res?.ok) router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await removeAvatarAction();
    setBusy(false);
    toast(res?.ok ? "success" : "error", (res?.ok ? res.message : res?.error) ?? "");
    if (res?.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar path={path} name={name} email={email} size={88} />
      <div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline !py-2" disabled={busy} onClick={() => ref.current?.click()}>
            <Camera className="size-4" aria-hidden /> {busy ? "Working…" : path ? "Change Photo" : "Upload Photo"}
          </button>
          {path && <button type="button" className="btn-outline !py-2" disabled={busy} onClick={remove}>Remove Photo</button>}
        </div>
        <p className="mt-2 text-sm text-muted">JPG, PNG or WebP, up to 2 MB.</p>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a profile photo"
          onChange={(e) => pick(e.target.files?.[0])} />
      </div>
    </div>
  );
}

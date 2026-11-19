"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { ImageUploader } from "./ImageUploader";
import { ConfirmButton } from "./ConfirmButton";
import { useToast } from "@/components/ui/Toast";
import { saveSocialLinksAction, setAboutHeroAction } from "@/server/actions/admin";
import type { SocialLink } from "@/server/queries/site";

/** Admin: choose the wide photo behind the About Us heading. Without one, the built-in Pahiyas photo is used. */
export function AboutHeroEditor({ url }: { url: string | null }) {
  return (
    <div className="space-y-4">
      <div className="relative aspect-[16/6] w-full overflow-hidden rounded-xl bg-line/40">
        <Image src={url ?? "/images/pahiyas-festival.jpg"} alt="About page banner preview" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
      </div>
      <ImageUploader bucket="hero-banners" folder="about" label={url ? "Change Photo" : "Upload Photo"} onUploaded={(p) => setAboutHeroAction(p)}
        actions={url ? <ConfirmButton className="btn border-2 border-red-700 text-red-700 hover:bg-red-50" confirm="Remove this photo and use the built-in one?" action={() => setAboutHeroAction(null)}>Remove</ConfirmButton> : undefined} />
      {!url && <p className="text-sm text-muted">The built-in Pahiyas photo is showing. Wide, bright photos work best.</p>}
    </div>
  );
}

/** Admin: the link behind each footer social button, and whether the button is shown at all. */
export function SocialLinksForm({ links }: { links: SocialLink[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(links.map((l) => ({ ...l })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: string, patch: Partial<SocialLink>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function save(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    for (const r of rows) if (!/^https:\/\/[^\s/]+\.[^\s]{2,}$/i.test(r.href.trim())) found[r.key] = "Enter a full link that starts with https://";
    setErrors(found);
    if (Object.keys(found).length) { toast("error", "Please fix the highlighted links."); return; }
    start(async () => {
      const r = await saveSocialLinksAction(rows.map((x) => ({ key: x.key, href: x.href.trim(), visible: x.visible })));
      if (r?.ok) toast("success", r.message ?? "Saved."); else toast("error", r?.error ?? "Something went wrong.");
    });
  }

  return (
    <form noValidate onSubmit={save} className="space-y-4">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`soc-${r.key}`} className="label !mb-0">{r.label} Link</label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={r.visible} onChange={(e) => set(r.key, { visible: e.target.checked })} className="accent-[var(--lb-orange)]" />
              Show Button
            </label>
          </div>
          <input id={`soc-${r.key}`} className={`input mt-1 ${r.visible ? "" : "opacity-60"}`} value={r.href} onChange={(e) => set(r.key, { href: e.target.value })}
            placeholder={`https://www.${r.key}.com/yourpage`} aria-invalid={!!errors[r.key]} />
          {errors[r.key] && <p role="alert" className="field-error">{errors[r.key]}</p>}
        </div>
      ))}
      <p className="text-sm text-muted">Hidden buttons stay saved, so you can bring them back later. They disappear from the footer and the Contact page.</p>
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}

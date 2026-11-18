"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { ImageUploader } from "./ImageUploader";
import { useToast } from "@/components/ui/Toast";
import { addHeroSlideAction, deleteHeroSlideAction, moveHeroSlideAction, updateHeroSlideAction } from "@/server/actions/admin";
import type { HeroSlideRow } from "@/server/queries/admin";
import type { FormState } from "@/server/actions/admin";

export function HeroSlideUploader() {
  return <ImageUploader bucket="hero-banners" folder="slides" label="Upload Photo" multiple onUploaded={(p) => addHeroSlideAction(p)} />;
}

function Row({ slide, first, last }: { slide: HeroSlideRow; first: boolean; last: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [alt, setAlt] = useState(slide.alt);
  const [link, setLink] = useState(slide.link_url);
  const [active, setActive] = useState(slide.is_active);

  function run(fn: () => Promise<FormState>, ok?: string) {
    start(async () => {
      try {
        const r = await fn();
        if (r?.ok) { if (ok) toast("success", ok); } else toast("error", r?.error ?? "Something went wrong.");
      } catch { toast("error", "Couldn't reach the server. Try again."); }
    });
  }

  return (
    <li className="card flex flex-col gap-4 p-4 sm:flex-row">
      <div className="relative aspect-[5/4] w-full shrink-0 overflow-hidden rounded-xl bg-line/40 sm:w-56">
        <Image src={slide.image_url} alt={slide.alt} fill sizes="224px" className={`object-cover ${active ? "" : "opacity-40"}`} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <label className="label" htmlFor={`alt-${slide.id}`}>Photo description (for screen readers)</label>
          <input id={`alt-${slide.id}`} className="input" value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`link-${slide.id}`}>Opens this page when clicked</label>
          <input id={`link-${slide.id}`} className="input" value={link} maxLength={200} onChange={(e) => setLink(e.target.value)} placeholder="/shop?sale=1" />
          <p className="mt-1 text-xs text-muted">A page on this site, such as /shop, /shop?sale=1 or /stores.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Show on the home page
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={pending}
            onClick={() => run(() => updateHeroSlideAction(slide.id, { alt, link_url: link, is_active: active }), "Slide saved")}>Save</button>
          <button type="button" className="btn-outline" disabled={pending || first} aria-label="Move Earlier" onClick={() => run(() => moveHeroSlideAction(slide.id, "up"))}><ArrowUp className="size-4" aria-hidden /></button>
          <button type="button" className="btn-outline" disabled={pending || last} aria-label="Move Later" onClick={() => run(() => moveHeroSlideAction(slide.id, "down"))}><ArrowDown className="size-4" aria-hidden /></button>
          <button type="button" className="btn-outline text-red-700" disabled={pending} aria-label="Delete Slide"
            onClick={() => { if (window.confirm("Delete this photo from the home page?")) run(() => deleteHeroSlideAction(slide.id), "Photo deleted"); }}><Trash2 className="size-4" aria-hidden /></button>
        </div>
      </div>
    </li>
  );
}

export function HeroSlideList({ slides }: { slides: HeroSlideRow[] }) {
  return (
    <ul className="space-y-4">
      {slides.map((s, i) => <Row key={s.id} slide={s} first={i === 0} last={i === slides.length - 1} />)}
    </ul>
  );
}

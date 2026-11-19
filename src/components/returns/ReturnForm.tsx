"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_REQUIRED, RETURN_PHOTO_COUNT, RETURN_PHOTO_MAX, RETURN_PHOTO_TYPES, RETURN_REASONS, type ReturnReason } from "@/lib/returns";
import { formatPeso } from "@/lib/utils/format";
import { createReturnAction } from "@/server/actions/returns";

type Item = { id: string; name: string; variant: string; price: number; quantity: number };

/** Customer: choose items, explain the problem, attach photos. Photos go to the private folder first; then the server records the request. */
export function ReturnForm({ userId, storeOrderId, orderId, items }: { userId: string; storeOrderId: string; orderId: string; items: Item[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [desired, setDesired] = useState<"refund" | "replacement">("refund");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const input = useRef<HTMLInputElement>(null);
  const err = (k: string) => errors[k] && <p role="alert" className="field-error">{errors[k]}</p>;
  const total = items.reduce((s, i) => s + (qty[i.id] ?? 0) * i.price, 0);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!RETURN_PHOTO_TYPES[f.type]) { toast("error", "Use JPG, PNG or WebP photos."); continue; }
      if (f.size > RETURN_PHOTO_MAX) { toast("error", `${f.name} is larger than 5 MB.`); continue; }
      if (next.length >= RETURN_PHOTO_COUNT) { toast("error", `You can attach up to ${RETURN_PHOTO_COUNT} photos.`); break; }
      next.push(f);
    }
    setFiles(next); if (input.current) input.current.value = ""; setErrors((e) => ({ ...e, photos: "" }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const chosen = items.filter((i) => (qty[i.id] ?? 0) > 0).map((i) => ({ order_item_id: i.id, quantity: qty[i.id] }));
    const found: Record<string, string> = {};
    if (!chosen.length) found.items = "Choose at least one item";
    if (!reason) found.reason = "Choose a reason";
    if (details.trim().length < 5) found.details = "Please describe the problem (at least 5 characters)";
    if (reason && PHOTO_REQUIRED.includes(reason) && files.length === 0) found.photos = "Add at least one photo of the problem";
    setErrors(found);
    if (Object.keys(found).length) { toast("error", "Please fix the highlighted fields."); return; }

    start(async () => {
      const supabase = createClient();
      const uploaded: string[] = [];
      try {
        for (const f of files) {
          const path = `${userId}/${crypto.randomUUID()}.${RETURN_PHOTO_TYPES[f.type]}`;
          const { error } = await supabase.storage.from("return-evidence").upload(path, f, { contentType: f.type, upsert: false });
          if (error) throw new Error(`${f.name}: ${error.message}`);
          uploaded.push(path);
        }
        const r = await createReturnAction({ storeOrderId, reason: reason as ReturnReason, desired, details, items: chosen, photos: uploaded });
        if (!r.ok) {
          if (uploaded.length) await supabase.storage.from("return-evidence").remove(uploaded);
          setErrors(r.fieldErrors ?? {}); toast("error", r.error); return;
        }
        toast("success", r.message);
        router.push(`/account/returns/${r.id}`);
      } catch (ex) {
        if (uploaded.length) await supabase.storage.from("return-evidence").remove(uploaded);
        toast("error", ex instanceof Error ? ex.message : "Couldn't upload your photos. Check your connection and try again.");
      }
    });
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-6">
      <fieldset className="card p-5">
        <legend className="px-1 text-xl font-bold text-brand">Which Items Have a Problem?</legend>
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0">{i.name}{i.variant ? ` (${i.variant})` : ""}<span className="block text-muted">Bought {i.quantity} @ {formatPeso(i.price)}</span></span>
              <label className="flex items-center gap-2">
                <span className="text-muted">How many?</span>
                <Select aria-label={`Quantity of ${i.name}`} value={String(qty[i.id] ?? 0)} onChange={(v) => setQty({ ...qty, [i.id]: Number(v) })} className="!w-20">
                  {Array.from({ length: i.quantity + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </label>
            </li>
          ))}
        </ul>
        {err("items")}
      </fieldset>

      <section className="card space-y-4 p-5">
        <div>
          <label htmlFor="rr-reason" className="label">What Went Wrong?</label>
          <Select id="rr-reason" value={reason} onChange={(v) => setReason(v as ReturnReason)} aria-invalid={!!errors.reason}>
            <option value="">Select a reason</option>
            {(Object.keys(RETURN_REASONS) as ReturnReason[]).map((k) => <option key={k} value={k}>{RETURN_REASONS[k]}</option>)}
          </Select>
          {err("reason")}
        </div>
        <div>
          <label htmlFor="rr-details" className="label">Tell Us More</label>
          <textarea id="rr-details" rows={4} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} aria-invalid={!!errors.details}
            className="input" placeholder="e.g. The box was crushed and the longganisa packs were leaking." />
          {err("details")}
        </div>
        <div>
          <p className="label">What Would You Like?</p>
          <div className="flex flex-wrap gap-3">
            {(["refund", "replacement"] as const).map((d) => (
              <label key={d} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-blue-50">
                <input type="radio" name="desired" checked={desired === d} onChange={() => setDesired(d)} className="accent-[var(--lb-orange)]" />
                {d === "refund" ? "A Refund" : "A Replacement"}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Photos {reason && PHOTO_REQUIRED.includes(reason) ? "(Required)" : "(Optional)"}</p>
          <ul className="flex flex-wrap gap-3">
            {files.map((f, n) => (
              <li key={n} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(f)} alt={`Selected photo ${n + 1}`} className="size-24 rounded-lg border border-line object-cover" />
                <button type="button" onClick={() => setFiles(files.filter((_, k) => k !== n))} aria-label={`Remove photo ${n + 1}`}
                  className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-danger text-white"><X className="size-3.5" aria-hidden /></button>
              </li>
            ))}
            {files.length < RETURN_PHOTO_COUNT && (
              <li>
                <button type="button" onClick={() => input.current?.click()} className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-xs text-muted hover:bg-blue-50">
                  <ImagePlus className="size-5" aria-hidden /> Add Photo
                </button>
              </li>
            )}
          </ul>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Choose photos" onChange={(e) => addFiles(e.target.files)} />
          <p className="mt-1 text-sm text-muted">Up to {RETURN_PHOTO_COUNT} photos, 5 MB each. Show the item and the packaging.</p>
          {err("photos")}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Items you chose: <span className="font-bold text-ink">{formatPeso(total)}</span>. The store decides the final refund.</p>
        <div className="flex gap-3">
          <button type="button" className="btn-outline" onClick={() => router.push(`/orders/${orderId}`)}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Send Request"}</button>
        </div>
      </div>
    </form>
  );
}
